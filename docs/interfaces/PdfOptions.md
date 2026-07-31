[**API**](../API.md)

***

# Interface: PdfOptions

Defined in: [mdast-util-to-pdf.ts:213](https://github.com/inokawa/remark-pdf/blob/129c0b5b4e0be73461061d006a93a217c5e246bc/src/mdast-util-to-pdf.ts#L213)

## Properties

### fonts?

> `optional` **fonts?**: (`StandardFontType` \| `CustomFont`)[]

Defined in: [mdast-util-to-pdf.ts:218](https://github.com/inokawa/remark-pdf/blob/129c0b5b4e0be73461061d006a93a217c5e246bc/src/mdast-util-to-pdf.ts#L218)

Standard fonts or privided custom fonts.

#### Default

```ts
"Helvetica"
```

***

### size?

> `optional` **size?**: `"A0"` \| `"A1"` \| `"A2"` \| `"A3"` \| `"A4"` \| `"A5"` \| `"A6"` \| `"A7"` \| `"A8"` \| `"A9"` \| `"A10"` \| `"B0"` \| `"B1"` \| `"B2"` \| `"B3"` \| `"B4"` \| `"B5"` \| `"B6"` \| `"B7"` \| `"B8"` \| `"B9"` \| `"B10"` \| `"C0"` \| `"C1"` \| `"C2"` \| `"C3"` \| `"C4"` \| `"C5"` \| `"C6"` \| `"C7"` \| `"C8"` \| `"C9"` \| `"C10"`

Defined in: [mdast-util-to-pdf.ts:224](https://github.com/inokawa/remark-pdf/blob/129c0b5b4e0be73461061d006a93a217c5e246bc/src/mdast-util-to-pdf.ts#L224)

Page size.
https://pdfkit.org/docs/paper_sizes.html

#### Default

```ts
A4
```

***

### margin?

> `optional` **margin?**: `number` \| \{ `top?`: `number`; `left?`: `number`; `bottom?`: `number`; `right?`: `number`; \}

Defined in: [mdast-util-to-pdf.ts:262](https://github.com/inokawa/remark-pdf/blob/129c0b5b4e0be73461061d006a93a217c5e246bc/src/mdast-util-to-pdf.ts#L262)

Page margin.

#### Default

```ts
40
```

***

### orientation?

> `optional` **orientation?**: `"portrait"` \| `"landscape"`

Defined in: [mdast-util-to-pdf.ts:269](https://github.com/inokawa/remark-pdf/blob/129c0b5b4e0be73461061d006a93a217c5e246bc/src/mdast-util-to-pdf.ts#L269)

Page orientation.

#### Default

```ts
"portrait"
```

***

### spacing?

> `optional` **spacing?**: `number`

Defined in: [mdast-util-to-pdf.ts:274](https://github.com/inokawa/remark-pdf/blob/129c0b5b4e0be73461061d006a93a217c5e246bc/src/mdast-util-to-pdf.ts#L274)

Spacing after Paragraphs.

#### Default

```ts
undefined
```

***

### thematicBreak?

> `optional` **thematicBreak?**: `ThematicBreakStyle`

Defined in: [mdast-util-to-pdf.ts:281](https://github.com/inokawa/remark-pdf/blob/129c0b5b4e0be73461061d006a93a217c5e246bc/src/mdast-util-to-pdf.ts#L281)

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

Defined in: [mdast-util-to-pdf.ts:285](https://github.com/inokawa/remark-pdf/blob/129c0b5b4e0be73461061d006a93a217c5e246bc/src/mdast-util-to-pdf.ts#L285)

Styles that override the defaults.

#### Type Declaration

##### default?

> `optional` **default?**: `Partial`\<`TextStyle`\>

***

### textStyle?

> `optional` **textStyle?**: `TextStyleMatcher`[]

Defined in: [mdast-util-to-pdf.ts:289](https://github.com/inokawa/remark-pdf/blob/129c0b5b4e0be73461061d006a93a217c5e246bc/src/mdast-util-to-pdf.ts#L289)

An option to find text and apply style (e.g. font to emoji)

***

### loadImage?

> `optional` **loadImage?**: `LoadImageFn`

Defined in: [mdast-util-to-pdf.ts:294](https://github.com/inokawa/remark-pdf/blob/129c0b5b4e0be73461061d006a93a217c5e246bc/src/mdast-util-to-pdf.ts#L294)

A function to resolve image data from url.

#### Default

loadWithFetch
