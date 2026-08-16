# TEST AGENT PROMPT – IMAGE INTEGRATION RULES
- Always use base64-encoded images for all tests.
- Accepted formats: JPEG, PNG, WEBP only.
- Every image must contain real visual features (objects, edges, textures).
- If image is non-supported format, transcode to PNG/JPEG.
- For animated images, extract first frame only.
- Resize large images to reasonable bounds.
