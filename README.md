# 4BitLabs website

Website for **4BitLabs** (4BitsLabs Technologies LLP), Nagpur: robotics kits, STEM workshops and tech events.

Built with plain HTML, CSS and JavaScript. There is no framework and no build step.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Structure

```
site/
├── index.html        Home
├── about.html
├── workshops.html
├── kits.html
├── events.html
├── gallery.html
├── contact.html
├── 404.html
├── css/styles.css    All styles (tokens → base → layout → components → pages)
├── js/main.js        Navigation, gallery, kit enquiry, contact form
├── images/           Logo, icons, photos
├── robots.txt
└── sitemap.xml
```
