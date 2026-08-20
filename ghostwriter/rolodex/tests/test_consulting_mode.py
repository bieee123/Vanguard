# Standard Libraries
import logging

# Django Imports
from django.test import TestCase, override_settings
from django.urls import reverse

# Ghostwriter Libraries
from ghostwriter.factories import ClientFactory, UserFactory
from ghostwriter.rolodex.models import Client

logging.disable(logging.CRITICAL)

PASSWORD = "SuperNaturalReporting!"


@override_settings(CONSULTING_MODE=False)
class ConsultingModeDisabledTests(TestCase):
    """Verify client-management views are hidden when consulting mode is off."""

    @classmethod
    def setUpTestData(cls):
        cls.manager = UserFactory(password=PASSWORD, role="admin")
        cls.client_row = ClientFactory()

    def setUp(self):
        self.client.login(username=self.manager.username, password=PASSWORD)

    def test_client_list_is_hidden(self):
        response = self.client.get(reverse("rolodex:clients"))
        self.assertEqual(response.status_code, 404)

    def test_client_detail_is_hidden(self):
        response = self.client.get(reverse("rolodex:client_detail", kwargs={"pk": self.client_row.pk}))
        self.assertEqual(response.status_code, 404)

    def test_client_create_is_hidden(self):
        response = self.client.get(reverse("rolodex:client_create"))
        self.assertEqual(response.status_code, 404)

    def test_client_update_is_hidden(self):
        response = self.client.get(reverse("rolodex:client_update", kwargs={"pk": self.client_row.pk}))
        self.assertEqual(response.status_code, 404)

    def test_client_delete_is_hidden(self):
        response = self.client.get(reverse("rolodex:client_delete", kwargs={"pk": self.client_row.pk}))
        self.assertEqual(response.status_code, 404)

    def test_project_list_is_available(self):
        response = self.client.get(reverse("rolodex:projects"))
        self.assertEqual(response.status_code, 200)


@override_settings(CONSULTING_MODE=False)
class ConsultingModeProjectCreationTests(TestCase):
    """Verify project creation binds to the default client when consulting is off."""

    @classmethod
    def setUpTestData(cls):
        cls.manager = UserFactory(password=PASSWORD, role="admin")

    def setUp(self):
        self.client.login(username=self.manager.username, password=PASSWORD)

    def test_project_create_binds_default_client(self):
        response = self.client.get(reverse("rolodex:project_create_no_client"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="client"')
        self.assertEqual(response.context["client"], Client.objects.order_by("id").first())


@override_settings(CONSULTING_MODE=True)
class ConsultingModeEnabledTests(TestCase):
    """Verify client-management views remain reachable when consulting mode is on."""

    @classmethod
    def setUpTestData(cls):
        cls.manager = UserFactory(password=PASSWORD, role="admin")
        cls.client_row = ClientFactory()

    def setUp(self):
        self.client.login(username=self.manager.username, password=PASSWORD)

    def test_client_list_is_available(self):
        response = self.client.get(reverse("rolodex:clients"))
        self.assertEqual(response.status_code, 200)