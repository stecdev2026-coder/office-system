# Jampack admin UI integration

Source supplied by user: E:/Codex_Jobs/jampack-robust/next_jampack_themeforest_pack/next-jampack/classic
Layout references: src/layout/Sidebar/SidebarHeader.jsx, SidebarMenu.jsx, src/styles/scss/vertical-classic-menu.scss and variables.scss (Teal Primary Edition).

Adapted the classic 270px navigation, grouped menus, compact rail, topbar, breadcrumbs and teal #007D88 design tokens to existing React/Next.js 16 components. Admin-only styles are in app/admin/jampack.css. Retains real office data, server authentication, attendance and Excel export. Does not import vendor demo data, Bootstrap global CSS or package.json dependencies from the template.

Extensions: react-select and react-datepicker use MIT licenses for searchable admin dropdowns and calendar popovers. Existing lucide-react is ISC; existing ExcelJS is MIT. No premium FullCalendar modules, amCharts, ApexCharts, TinyMCE, lightGallery or other optional vendor packages are imported.

The provided ThemeForest template itself is separate from extension licensing; this integration does not claim that Jampack is a free template. No template license file was located in the supplied pack.

Admin route shell is rendered full width through components/AppContainer.tsx, including session validation and Suspense loading. AdminDatePicker keeps YYYY-MM-DD values while displaying DD/MM/YYYY and Thai month names. AdminSelect preserves name/defaultValue for existing forms and renders menus in a body portal to avoid clipping inside modals.
