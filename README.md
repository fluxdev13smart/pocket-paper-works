# Pocket Paper Works

I want to make a website which converts any file type to any file type, completely offline and private with zero internet connection needed, and with a PDF editor that lets people preview files, scroll through normally, and edit with marker, highlighter, color options, color wheel, and a scissor cutout tool to draw white rectangles over unwanted content.

## Locked
- Visual Direction: "Studio minimal" dark mode. Warm dark charcoal background (#121214) with subtle ambient top glow, darker surface cards (#1b1b1f), white-alpha hairline borders (rgba(255,255,255,0.07)), and warm amber accent (#f59e0b) reserved strictly for active tools, trust signals, and the primary CTA. No pure #000000 and no light mode sections ("redesign it, and i want dark mode only").
- Typography: Display headlines in 'Bricolage Grotesque' (tight tracking -0.03em), body and labels in 'Manrope', and metadata/file sizes in tabular figures with monospace ('Geist Mono' fallback).
- Header & Navigation: Floating pill island navigation detached from the top (max-w-[1000px], rounded-full, bg-[#1b1b1f]/80, border border-white/10) with brand "AnyConvert Local", status badge "Zero Network Requests • 100% In-Browser RAM", and nav links (Formats, Offline Mode, Architecture). Floating bottom pill tab dock for switching between views ("convert", "pages", "redact", "offline").
- Screen 1 (Home Workspace - converter-dark-studio):
  - Hero: "Private, in-browser file transformation", subtitle: "Your files never leave your device. Processed entirely inside your browser via WebAssembly."
  - Dropzone: Double-bezel container with dashed border, "Drop files to load into browser memory", security seal "Air-Gapped Ready • Zero Server Uploads", and format chips (Images, Audio, Video, Docs).
  - Conversion Queue: Interactive file list with original file name, tabular file size in RAM, target format selector dropdown per file, local engine badge ("Local WASM", "Local Canvas", "Local Audio Worker"), and status.
  - Action Footer: "Convert All Locally" amber primary pill button with nested chevron icon, "Download All (.zip)" secondary button, and RAM usage indicator.
  - Privacy Guarantee Strip: "100% Private: You can literally turn off your Wi-Fi and conversions will still execute without interruption."
- Screen 2 (PDF Viewer & Markup Studio - pdf-editor-catalog):
  - Document Viewer: Continuous vertical scroll displaying full rendered PDF pages.
  - Floating Markup Island Dock (bottom-center): Floating pill toolbar with 1px border containing:
    - Tool icons: Selection cursor, Scissor Cutout tool (draws clean white redaction rectangles over unwanted content), Marker pen, Highlighter, Eraser.
    - Color bar: Quick swatches (White #FFF, Amber #F59E0B, Charcoal #222, Red #EF4444) plus interactive color wheel picker.
    - Stroke thickness selector and Undo / Redo controls.
  - Top Bar: Document title, zoom controls (- 100% +), page counter ("Page 2 of 12"), page deletion/organization drawer trigger, and amber "Export Clean PDF" CTA button.
  - Export Behavior: Generates a completely new sanitized PDF client-side with redactions baked in, leaving the original uploaded file untouched.
- Core Architecture: 100% client-side zero-knowledge execution ("i dont want some random cloud i dont trust having my fiels"). Zero server uploads or third-party cloud APIs. Offline-first PWA with Service Worker caching so the entire site functions with zero internet connection once loaded ("make the webpage so zero internet connection would be neded").

## Open
- Client-side conversion engine implementations:
  - Images: HTML5 Canvas / OffscreenCanvas / WebCodecs supporting PNG, JPG, WebP, SVG, BMP, GIF, ICO with quality sliders.
  - Documents: pdf-lib and pdfjs-dist for in-browser PDF rendering, page extraction, page reordering, page deletion, and drawing white redaction annotations into the exported PDF buffer.
  - Audio/Video: Lightweight Web Audio API and JS/WASM encoders (lamejs for MP3, WebCodecs/FFmpeg.wasm for media transcoding).
  - Text & Data: Native parsing and conversion between Markdown, HTML, TXT, JSON, CSV.
  - ZIP packaging: JSZip for batch downloads of converted files.
- Progressive Web App setup: manifest.json, Service Worker caching static assets and engine scripts, and an in-app "Install Offline App" button in the navigation.
- Empty states, drag-and-drop feedback states, conversion progress bars with percentage indicators, and error handling for corrupt files.
- Responsive layouts for tablet and mobile viewports following the desktop hierarchy.

build a real working app, not a clickable prototype; the screen and kit files show layout, content and look (a wireframe's, structure only) and are never code to copy. The screens are the moments the user designed, not the whole product. Before building, walk through each flow as its user would and design what the pictures leave out, as a product designer would for this product: the steps a flow needs to finish and how the app responds to what the user does, including the moments its users will actually run into, like waiting on something or finding nothing yet. Add nothing a user of this product would never meet, and keep an app the user wants simple, simple. Never leave a step the product's core flows need as "coming soon", unless the brief says the user chose to. Where such a step needs an outside service, build every part up to it and say in your reply what's left to connect. Fill product gaps only, never a look the design set: an added step reuses the UI kit's tokens, chrome and parts and the nearest designed screen's layout, with no new visual direction. Look at every screen's picture before writing code; design.md says which picture or sheet holds each screen. Open the UI kit's shells and parts HTML for the header, tab bar, composer and components, not only its tokens. Use each finished screen's copy exactly as design.md lists it; never invent copy for one. A wireframe under design.md's Wireframes gives structure only: build it in the design's look, as design.md says. The screens' photos are placeholders for the mockups only: replace every photo design.md lists with the user's own upload for it, else as design.md says (a photo without people re-composed with imagegen--edit_image from it as a reference, a photo of people generated from its brief and never from the photo), and ship no set photo or its URL. For a design that came with no design.md, every photo on assets.lovable.dev or images.unsplash.com is a set photo: replace it with the user's own upload for it, else a new image generated for its slot, any person in it one who doesn't exist, never from the photo or a picture showing it. Build and check each screen at the canvas it was drawn at: phone 393×764, tablet landscape 1133×744, tablet portrait 744×1133, desktop 1280×832. After building, screenshot the app at those sizes and states, compare each finished screen with its picture, and fix every visual difference you didn't choose; check a wireframe's screen against its structure, never its grey look. End your reply with "Changed from the mockups": each deliberate change and why, and "Added beyond the mockups": each step, state or interaction you built that no screen shows.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pocket-paper-works.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/123c0234-1e17-43d3-88a0-597c4a3e7bb4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
