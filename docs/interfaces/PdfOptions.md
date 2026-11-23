[**API**](../API.md)

***

# Interface: PdfOptions

Defined in: [mdast-util-to-pdf.ts:248](https://github.com/inokawa/remark-pdf/blob/fc57fe9e2d929161c1c15f96d3bcb78aaf3ba4ed/src/mdast-util-to-pdf.ts#L248)

## Properties

### fonts?

> `optional` **fonts?**: (`StandardFontType` \| `CustomFont`)[]

Defined in: [mdast-util-to-pdf.ts:253](https://github.com/inokawa/remark-pdf/blob/fc57fe9e2d929161c1c15f96d3bcb78aaf3ba4ed/src/mdast-util-to-pdf.ts#L253)

Standard fonts or privided custom fonts.

#### Default

```ts
"Helvetica"
```

***

### size?

> `optional` **size?**: `"A0"` \| `"A1"` \| `"A2"` \| `"A3"` \| `"A4"` \| `"A5"` \| `"A6"` \| `"A7"` \| `"A8"` \| `"A9"` \| `"A10"` \| `"B0"` \| `"B1"` \| `"B2"` \| `"B3"` \| `"B4"` \| `"B5"` \| `"B6"` \| `"B7"` \| `"B8"` \| `"B9"` \| `"B10"` \| `"C0"` \| `"C1"` \| `"C2"` \| `"C3"` \| `"C4"` \| `"C5"` \| `"C6"` \| `"C7"` \| `"C8"` \| `"C9"` \| `"C10"`

Defined in: [mdast-util-to-pdf.ts:259](https://github.com/inokawa/remark-pdf/blob/fc57fe9e2d929161c1c15f96d3bcb78aaf3ba4ed/src/mdast-util-to-pdf.ts#L259)

Page size.
https://pdfkit.org/docs/paper_sizes.html

#### Default

```ts
A4
```

***

### margin?

> `optional` **margin?**: `number` \| \{ `top?`: `number`; `left?`: `number`; `bottom?`: `number`; `right?`: `number`; \}

Defined in: [mdast-util-to-pdf.ts:297](https://github.com/inokawa/remark-pdf/blob/fc57fe9e2d929161c1c15f96d3bcb78aaf3ba4ed/src/mdast-util-to-pdf.ts#L297)

Page margin.

#### Default

```ts
40
```

***

### orientation?

> `optional` **orientation?**: `"portrait"` \| `"landscape"`

Defined in: [mdast-util-to-pdf.ts:304](https://github.com/inokawa/remark-pdf/blob/fc57fe9e2d929161c1c15f96d3bcb78aaf3ba4ed/src/mdast-util-to-pdf.ts#L304)

Page orientation.

#### Default

```ts
"portrait"
```

***

### spacing?

> `optional` **spacing?**: `number`

Defined in: [mdast-util-to-pdf.ts:309](https://github.com/inokawa/remark-pdf/blob/fc57fe9e2d929161c1c15f96d3bcb78aaf3ba4ed/src/mdast-util-to-pdf.ts#L309)

Spacing after Paragraphs.

#### Default

```ts
undefined
```

***

### thematicBreak?

> `optional` **thematicBreak?**: `ThematicBreakStyle`

Defined in: [mdast-util-to-pdf.ts:316](https://github.com/inokawa/remark-pdf/blob/fc57fe9e2d929161c1c15f96d3bcb78aaf3ba4ed/src/mdast-util-to-pdf.ts#L316)

How thematic break (`---`) is rendered.
- `"line"`: a horizontal line.
- `"pagebreak"`: a page break.

#### Default

```ts
"pagebreak"
```

***

### styles?

> `optional` **styles?**: `Partial`\<`StyleOption`\> & `object`

Defined in: [mdast-util-to-pdf.ts:320](https://github.com/inokawa/remark-pdf/blob/fc57fe9e2d929161c1c15f96d3bcb78aaf3ba4ed/src/mdast-util-to-pdf.ts#L320)

Styles that override the defaults.

#### Type Declaration

##### default?

> `optional` **default?**: `Partial`\<`TextStyle`\>

***

### textStyle?

> `optional` **textStyle?**: `TextStyleMatcher`[]

Defined in: [mdast-util-to-pdf.ts:324](https://github.com/inokawa/remark-pdf/blob/fc57fe9e2d929161c1c15f96d3bcb78aaf3ba4ed/src/mdast-util-to-pdf.ts#L324)

An option to find text and apply style (e.g. font to emoji)

***

### loadImage?

> `optional` **loadImage?**: `LoadImageFn`

Defined in: [mdast-util-to-pdf.ts:329](https://github.com/inokawa/remark-pdf/blob/fc57fe9e2d929161c1c15f96d3bcb78aaf3ba4ed/src/mdast-util-to-pdf.ts#L329)

A function to resolve image data from url.

#### Default

loadWithFetch
