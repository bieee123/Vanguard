"""Tests for the Knowledge Base models."""

# Django Imports
from django.test import TestCase

# Ghostwriter Libraries
from ghostwriter.factories import ProjectFactory, UserFactory
from ghostwriter.knowledge_base.models import Note, NoteLink
from ghostwriter.knowledge_base.tasks import embed_note


class NoteModelTests(TestCase):
    """Test the :model:`knowledge_base.Note` model."""

    @classmethod
    def setUpTestData(cls):
        cls.user = UserFactory()
        cls.project = ProjectFactory()

    def test_create_note(self):
        note = Note.objects.create(title="Test Note", body_markdown="# Hello", created_by=self.user)
        self.assertEqual(note.title, "Test Note")
        self.assertFalse(note.exclude_from_rag)
        self.assertEqual(Note.objects.count(), 1)

    def test_note_str(self):
        note = Note.objects.create(title="Test Note")
        self.assertEqual(str(note), "Test Note")

    def test_get_absolute_url(self):
        note = Note.objects.create(title="Test Note")
        self.assertEqual(note.get_absolute_url(), f"/knowledge-base/notes/{note.id}")

    def test_wikilink_titles(self):
        note = Note.objects.create(title="Test Note", body_markdown="See [[Other Note]] and [[Missing]] here")
        self.assertEqual(note.wikilink_titles(), ["Other Note", "Missing"])

    def test_wikilink_titles_empty(self):
        note = Note.objects.create(title="Test Note", body_markdown="No links here")
        self.assertEqual(note.wikilink_titles(), [])

    def test_resolve_links_creates_note_link(self):
        target = Note.objects.create(title="Target Note")
        source = Note.objects.create(title="Source Note", body_markdown="Link to [[Target Note]]")
        source.resolve_links()
        self.assertEqual(NoteLink.objects.count(), 1)
        link = NoteLink.objects.get(source_note=source)
        self.assertEqual(link.target_note, target)
        self.assertEqual(link.target_title_raw, "Target Note")

    def test_resolve_links_broken_target(self):
        source = Note.objects.create(title="Source Note", body_markdown="Link to [[Does Not Exist]]")
        source.resolve_links()
        self.assertEqual(NoteLink.objects.count(), 1)
        link = NoteLink.objects.get(source_note=source)
        self.assertIsNone(link.target_note)
        self.assertEqual(link.target_title_raw, "Does Not Exist")

    def test_resolve_links_case_insensitive(self):
        Note.objects.create(title="Target Note")
        source = Note.objects.create(title="Source Note", body_markdown="Link to [[target note]]")
        source.resolve_links()
        link = NoteLink.objects.get(source_note=source)
        self.assertIsNotNone(link.target_note)
        self.assertEqual(link.target_note.title, "Target Note")

    def test_resolve_links_drops_stale(self):
        target = Note.objects.create(title="Target Note")
        source = Note.objects.create(title="Source Note", body_markdown="Link to [[Target Note]]")
        source.resolve_links()
        self.assertEqual(NoteLink.objects.count(), 1)
        source.body_markdown = "No more links"
        source.save()
        source.resolve_links()
        self.assertEqual(NoteLink.objects.count(), 0)

    def test_backlinks(self):
        target = Note.objects.create(title="Target Note")
        source = Note.objects.create(title="Source Note", body_markdown="Link to [[Target Note]]")
        source.resolve_links()
        self.assertEqual(list(target.backlinks()), [source])

    def test_engagement_link(self):
        note = Note.objects.create(title="Note", engagement=self.project)
        self.assertEqual(note.engagement, self.project)

    def test_embedding_task_empty_body(self):
        note = Note.objects.create(title="Empty", body_markdown="")
        embed_note(note.id)
        self.assertEqual(note.embeddings.count(), 0)

    def test_embedding_task_chunks_without_provider(self):
        note = Note.objects.create(
            title="Chunky",
            body_markdown="Paragraph one.\n\nParagraph two.\n\nParagraph three.",
        )
        embed_note(note.id, chunk_size=20)
        self.assertEqual(note.embeddings.count(), 3)
        self.assertEqual(list(note.embeddings.values_list("chunk_index", flat=True)), [0, 1, 2])
        self.assertFalse(note.embeddings.first().excluded_from_rag)

    def test_embedding_task_excluded_note(self):
        note = Note.objects.create(
            title="Secret",
            body_markdown="Contains sensitive content.",
            exclude_from_rag=True,
        )
        embed_note(note.id)
        self.assertEqual(note.embeddings.count(), 1)
        self.assertTrue(note.embeddings.first().excluded_from_rag)

    def test_embedding_task_rechunk_on_resave(self):
        note = Note.objects.create(title="Rechunk", body_markdown="One.\n\nTwo.")
        embed_note(note.id, chunk_size=5)
        self.assertEqual(note.embeddings.count(), 2)
        note.body_markdown = "Only one."
        note.save()
        embed_note(note.id)
        self.assertEqual(note.embeddings.count(), 1)