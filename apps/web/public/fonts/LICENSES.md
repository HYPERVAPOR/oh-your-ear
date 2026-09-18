# Bundled fonts

Both families are self-hosted so the app has no third-party runtime dependency and keeps working
offline (the PWA caches these files with the app shell).

| File                                                   | Family     | Axis                              | Source                                                       |
| ------------------------------------------------------ | ---------- | --------------------------------- | ------------------------------------------------------------ |
| `inter-latin.woff2`, `inter-latin-ext.woff2`           | Inter      | weight 100–900                    | [Google Fonts](https://fonts.google.com/specimen/Inter)      |
| `newsreader-latin.woff2`, `newsreader-latin-ext.woff2` | Newsreader | optical size 6–72, weight 200–800 | [Google Fonts](https://fonts.google.com/specimen/Newsreader) |

Both are licensed under the **SIL Open Font License 1.1**, which permits bundling and redistribution:
<https://openfontlicense.org>.

CJK text is **not** bundled: a Chinese webfont is several megabytes, and Songti / PingFang / Microsoft
YaHei / Noto Serif CJK are already present on the platforms this app targets. The font stacks in
`DESIGN.md` list them as fallbacks.
