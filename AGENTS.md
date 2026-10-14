<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI conventions
- Every button and button-like control must use cursor: pointer. This includes existing buttons.
- Personal profile screens must not edit HR fields (employee code, department, division, branch, work group, position, role, leave quota or account status); enforce this on the server.
