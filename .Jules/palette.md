## 2026-05-07 - Inline Form Validation for Custom Modals
**Learning:** In vanilla JS custom modals where native browser form submission is bypassed, submitting empty required fields without explicit visual or ARIA feedback causes confusion.
**Action:** Always pair `aria-invalid="true"` and `aria-describedby` pointing to a `role="alert"` helper container with a `.form-ctrl-error` CSS class, and listen to `input` events to clear the error dynamically as the user types.
