"""Forms for the Purple Team Sync application."""

# Django Imports
from django import forms

# Ghostwriter Libraries
from ghostwriter.assets.models import Asset
from ghostwriter.purple_team.models import DetectionVerdict, RuleRequest, TimelineEntry


class TimelineEntryForm(forms.ModelForm):
    """Form for creating/updating a timeline entry (PRD 5.5)."""

    class Meta:
        model = TimelineEntry
        fields = [
            "engagement",
            "asset",
            "technique_id",
            "tactic",
            "timestamp",
            "action_description",
            "outcome",
            "note",
            "sequence_order",
        ]
        widgets = {
            "timestamp": forms.DateTimeInput(
                attrs={"class": "form-control", "type": "datetime-local"},
                format="%Y-%m-%dT%H:%M",
            ),
            "action_description": forms.Textarea(attrs={"rows": 3, "class": "form-control"}),
            "note": forms.Textarea(attrs={"rows": 2, "class": "form-control"}),
        }

    def __init__(self, *args, **kwargs):
        self.request = kwargs.pop("request", None)
        super().__init__(*args, **kwargs)
        self.fields["timestamp"].input_formats = [
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
        ]
        self.fields["sequence_order"].required = False
        for field in self.fields.values():
            if field.widget.__class__.__name__ not in ("CheckboxInput",):
                field.widget.attrs.setdefault("class", "form-control")

    def clean_technique_id(self):
        technique_id = self.cleaned_data.get("technique_id", "").strip().upper()
        if not technique_id:
            return ""
        if not technique_id.startswith("T"):
            technique_id = f"T{technique_id}"
        return technique_id


class DetectionVerdictForm(forms.ModelForm):
    """Form for confirming/overriding a detection verdict (PRD 5.7)."""

    class Meta:
        model = DetectionVerdict
        fields = [
            "verdict",
            "matched_sentinel_alert_id",
            "detection_delay_seconds",
        ]
        widgets = {
            "detection_delay_seconds": forms.NumberInput(attrs={"class": "form-control"}),
        }


class RuleRequestForm(forms.ModelForm):
    """Form for creating a draft rule request (design.md 5.6 drawer)."""

    class Meta:
        model = RuleRequest
        fields = [
            "technique_id",
            "timeline_entry",
            "draft_rule_xml",
            "test_log_sample_path",
            "justification",
        ]
        widgets = {
            "draft_rule_xml": forms.Textarea(attrs={"rows": 8, "class": "form-control font-monospace"}),
            "justification": forms.Textarea(attrs={"rows": 4, "class": "form-control"}),
            "test_log_sample_path": forms.TextInput(attrs={"class": "form-control"}),
        }

    def clean_technique_id(self):
        technique_id = self.cleaned_data.get("technique_id", "").strip().upper()
        if not technique_id.startswith("T"):
            technique_id = f"T{technique_id}"
        return technique_id

    def clean(self):
        cleaned = super().clean()
        if not cleaned.get("draft_rule_xml", "").strip():
            self.add_error("draft_rule_xml", "A draft rule is required to create a request.")
        return cleaned