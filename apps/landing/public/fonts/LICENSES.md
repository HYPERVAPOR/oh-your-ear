# Bundled fonts

The Latin face is self-hosted so the app has no third-party runtime dependency and keeps working
offline (the PWA caches these files with the app shell).

| File                                              | Family         | Axis           | Source                                                                          |
| ------------------------------------------------- | -------------- | -------------- | ------------------------------------------------------------------------------- |
| `jetbrains-mono-latin.woff2`, `…-latin-ext.woff2` | JetBrains Mono | weight 100–800 | [Fontsource](https://fontsource.org/fonts/jetbrains-mono) (upstream: JetBrains) |

Licensed under the **SIL Open Font License 1.1**, which permits bundling and redistribution:
<https://openfontlicense.org>.

CJK text is **not** bundled: a Chinese webfont is several megabytes, and PingFang / Microsoft YaHei /
Noto Sans CJK are already present on the platforms this app targets. The stack names monospaced CJK
faces (Sarasa Mono SC, Noto Sans Mono CJK SC, Maple Mono CN) first, so machines that have one get a
fully monospaced grid; everyone else gets their platform's proportional CJK face.
