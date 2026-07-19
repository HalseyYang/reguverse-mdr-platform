# Step 1 Reviewable Output Design

Step 1 generated output becomes a review surface, not only a static card. The backend stores structured fields with profile values, uploaded extraction candidates, selected source, confirmation status, and a locked flag after approval.

Required behavior:
- Generated Step 1 fields expose profile value and extracted value when available.
- Reviewer can edit a field value and mark it confirmed.
- Reviewer can accept the uploaded extraction value or keep the device-profile value.
- Approved Step 1 output is locked; later edit attempts return conflict.
- Frontend renders field-level controls only when the output is not locked.

Testing:
- API integration test covers generate, edit, approve lock, and rejected post-approval edit.
