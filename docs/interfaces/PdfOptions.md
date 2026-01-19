[**API**](../API.md)

***

# Interface: PdfOptions

Defined in: [mdast-util-to-pdf.ts:183](https://github.com/inokawa/remark-pdf/blob/bd187c9453d24ba281785c9e6e28f37e1baed824/src/mdast-util-to-pdf.ts#L183)

## Properties

### fonts?

> `optional` **fonts**: (`StandardFontType` \| `CustomFont`)[]

Defined in: [mdast-util-to-pdf.ts:188](https://github.com/inokawa/remark-pdf/blob/bd187c9453d24ba281785c9e6e28f37e1baed824/src/mdast-util-to-pdf.ts#L188)

Standard fonts or privided custom fonts.

#### Default

```ts
"Helvetica"
```

***

### size?

> `optional` **size**: `"A0"` \| `"A1"` \| `"A2"` \| `"A3"` \| `"A4"` \| `"A5"` \| `"A6"` \| `"A7"` \| `"A8"` \| `"A9"` \| `"A10"` \| `"B0"` \| `"B1"` \| `"B2"` \| `"B3"` \| `"B4"` \| `"B5"` \| `"B6"` \| `"B7"` \| `"B8"` \| `"B9"` \| `"B10"` \| `"C0"` \| `"C1"` \| `"C2"` \| `"C3"` \| `"C4"` \| `"C5"` \| `"C6"` \| `"C7"` \| `"C8"` \| `"C9"` \| `"C10"`

Defined in: [mdast-util-to-pdf.ts:194](https://github.com/inokawa/remark-pdf/blob/bd187c9453d24ba281785c9e6e28f37e1baed824/src/mdast-util-to-pdf.ts#L194)

Page size.
https://pdfkit.org/docs/paper_sizes.html

#### Default

```ts
A4
```

***

### margin?

> `optional` **margin**: `number` \| \{ `top?`: `number`; `left?`: `number`; `bottom?`: `number`; `right?`: `number`; \}

Defined in: [mdast-util-to-pdf.ts:232](https://github.com/inokawa/remark-pdf/blob/bd187c9453d24ba281785c9e6e28f37e1baed824/src/mdast-util-to-pdf.ts#L232)

Page margin.

#### Default

```ts
40
```

***

### orientation?

> `optional` **orientation**: `"portrait"` \| `"landscape"`

Defined in: [mdast-util-to-pdf.ts:239](https://github.com/inokawa/remark-pdf/blob/bd187c9453d24ba281785c9e6e28f37e1baed824/src/mdast-util-to-pdf.ts#L239)

Page orientation.

#### Default

```ts
"portrait"
```

***

### spacing?

> `optional` **spacing**: `number`

Defined in: [mdast-util-to-pdf.ts:244](https://github.com/inokawa/remark-pdf/blob/bd187c9453d24ba281785c9e6e28f37e1baed824/src/mdast-util-to-pdf.ts#L244)

Spacing after Paragraphs.

#### Default

```ts
undefined
```

***

### styles?

> `optional` **styles**: `Partial`\<`StyleOption`\> & `object`

Defined in: [mdast-util-to-pdf.ts:248](https://github.com/inokawa/remark-pdf/blob/bd187c9453d24ba281785c9e6e28f37e1baed824/src/mdast-util-to-pdf.ts#L248)

Styles that override the defaults.

#### Type Declaration

##### default?

> `optional` **default**: `Partial`\<`TextStyle`\>

***

### textStyle?

> `optional` **textStyle**: `TextStyleMatcher`[]

Defined in: [mdast-util-to-pdf.ts:252](https://github.com/inokawa/remark-pdf/blob/bd187c9453d24ba281785c9e6e28f37e1baed824/src/mdast-util-to-pdf.ts#L252)

An option to find text and apply style (e.g. font to emoji)

***

### loadImage?

> `optional` **loadImage**: `LoadImageFn`

Defined in: [mdast-util-to-pdf.ts:257](https://github.com/inokawa/remark-pdf/blob/bd187c9453d24ba281785c9e6e28f37e1baed824/src/mdast-util-to-pdf.ts#L257)

A function to resolve image data from url.

#### Default

loadWithFetch
