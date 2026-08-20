"""Tests for the Knowledge Base views."""

# Django Imports
from django.test import TestCase
from django.urls import reverse

# Ghostwriter Libraries
from ghostwriter.factories import ProjectFactory, UserFactory
from ghostwriter.knowledge_base.models import Note

PASSWORD = "SuperNaturalReporting!"


class KnowledgeBaseViewTests(TestCase):
    """Test the Knowledge Base views."""

    @classmethod
    def setUpTestData(cls):
        cls.manager = UserFactory(password=PASSWORD, role="admin")
        cls.user = UserFactory(password=PASSWORD)
        cls.project = ProjectFactory()
        cls.note = Note.objects.create(
            title="View Note",
            body_markdown="Links to [[Other]]",
            created_by=cls.manager,
        )
        cls.other = Note.objects.create(title="Other", body_markdown="Linked back")
        cls.note.resolve_links()

    def setUp(self):
        self.client.login(username=self.manager.username, password=PASSWORD)

    def test_index_requires_login(self):
        self.client.logout()
        response = self.client.get(reverse("knowledge_base:index"))
        self.assertEqual(response.status_code, 302)

    def test_index_lists_notes(self):
        response = self.client.get(reverse("knowledge_base:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View Note")

    def test_index_search(self):
        response = self.client.get(reverse("knowledge_base:index"), {"q": "View"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View Note")
        self.assertNotContains(response, "Other")

    def test_note_detail(self):
        response = self.client.get(reverse("knowledge_base:note_detail", args=[self.note.id]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View Note")
        # Backlinks panel shows the note that links back
        self.assertContains(response, "Other")

    def test_note_create(self):
        response = self.client.get(reverse("knowledge_base:note_create"))
        self.assertEqual(response.status_code, 200)
        response = self.client.post(
            reverse("knowledge_base:note_create"),
            {
                "title": "Brand New",
                "body_markdown": "Body text",
                "engagement": "",
                "exclude_from_rag": "",
                "tags": "",
            },
        )
        self.assertEqual(response.status_code, 302)
        note = Note.objects.get(title="Brand New")
        self.assertEqual(note.created_by, self.manager)

    def test_note_update(self):
        response = self.client.post(
            reverse("knowledge_base:note_update", args=[self.note.id]),
            {
                "title": "View Note Updated",
                "body_markdown": "New body",
                "engagement": "",
                "exclude_from_rag": "",
                "tags": "",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.note.refresh_from_db()
        self.assertEqual(self.note.title, "View Note Updated")

    def test_note_delete(self):
        response = self.client.post(reverse("knowledge_base:note_delete", args=[self.note.id]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Note.objects.filter(id=self.note.id).exists())

    def test_ajax_autocomplete(self):
        response = self.client.get(reverse("knowledge_base:ajax_autocomplete"), {"q": "Vie"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("View Note", data["titles"])

    def test_ajax_note_links(self):
        response = self.client.get(reverse("knowledge_base:ajax_note_links", args=[self.note.id]))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["outgoing"]), 1)
        self.assertTrue(data["outgoing"][0]["resolved"])

    def test_graph_json_returns_nodes_and_edges(self):
        response = self.client.get(reverse("knowledge_base:graph_json"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(len(data["nodes"]), 2)
        self.assertGreaterEqual(len(data["edges"]), 1)

    def test_non_privileged_cannot_create(self):
        self.client.logout()
        self.client.login(username=self.user.username, password=PASSWORD)
        response = self.client.get(reverse("knowledge_base:note_create"))
        self.assertEqual(response.status_code, 302)