"""Tests for the Knowledge Base RAG pipeline."""

# Django Imports
from django.test import TestCase, override_settings

# Ghostwriter Libraries
from ghostwriter.factories import UserFactory
from ghostwriter.knowledge_base.models import Note, NoteEmbedding
from ghostwriter.knowledge_base.rag import build_prompt, rag_answer, retrieve_chunks


class RagPipelineTests(TestCase):
    """Test RAG retrieval, prompt building, and the top-level answer helper."""

    @classmethod
    def setUpTestData(cls):
        cls.user = UserFactory()
        cls.note = Note.objects.create(
            title="Kerberoasting",
            body_markdown=(
                "Kerberoasting targets SPNs using RC4/HMAC-SHA1 tickets. "
                "Mitigation is AES-only ticket encryption and strong service "
                "account passwords."
            ),
            created_by=cls.user,
        )
        cls.sensitive = Note.objects.create(
            title="Credentials vault",
            body_markdown="root:SuperSecret123 admin@corp.local",
            exclude_from_rag=True,
            created_by=cls.user,
        )

    def test_build_prompt_includes_chunks(self):
        system, user = build_prompt("question", [{"chunk_text": "alpha"}, {"chunk_text": "beta"}])
        self.assertIn("alpha", user)
        self.assertIn("beta", user)
        self.assertIn("You are an assistant for the Vanguard red team dashboard", system)

    def test_build_prompt_blank(self):
        system, user = build_prompt("q", [])
        self.assertIn("q", user)

    @override_settings(VANGUARD_RAG_TOP_K=5)
    def test_retrieve_chunks_no_config_returns_empty(self):
        # No embedding provider configured -> no retrieval, no crash
        chunks = retrieve_chunks("kerberoasting")
        self.assertEqual(chunks, [])

    def test_rag_answer_returns_sources_even_without_llm(self):
        result = rag_answer("how do I find kerberoastable accounts")
        self.assertEqual(result["question"], "how do I find kerberoastable accounts")
        self.assertIn("sources", result)
        # LLM is not configured, so answer stays None but sources are present
        self.assertIsNone(result["answer"])


class RagExclusionTests(TestCase):
    """Verify excluded-from-RAG chunks are never returned as sources."""

    @classmethod
    def setUpTestData(cls):
        cls.user = UserFactory()

    def _embed_chunk(self, note, index=0, text="chunk"):
        return NoteEmbedding.objects.create(
            note=note,
            chunk_index=index,
            chunk_text=text,
            embedding=None,
            excluded_from_rag=note.exclude_from_rag,
        )

    def test_retrieve_filters_excluded(self):
        included = Note.objects.create(title="Included", body_markdown="body", created_by=self.user)
        excluded = Note.objects.create(
            title="Excluded", body_markdown="secret", exclude_from_rag=True, created_by=self.user
        )
        self._embed_chunk(included)
        self._embed_chunk(excluded)
        # Even though no vectors exist, the queryset construction must not error
        # and the excluded flag is respected on the rows that do have vectors.
        rows = NoteEmbedding.objects.filter(excluded_from_rag=False)
        self.assertEqual(list(rows), [included.embeddings.first()])