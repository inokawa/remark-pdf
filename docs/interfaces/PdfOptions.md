[**API**](../API.md)

***

# Interface: PdfOptions

Defined in: [mdast-util-to-pdf.ts:189](https://github.com/inokawa/remark-pdf/blob/e73b7632f858e9881de3e62c7c6e8051f5a5640b/src/mdast-util-to-pdf.ts#L189)

## Properties

### fonts?

> `optional` **fonts**: (`StandardFontType` \| `CustomFont`)[]

Defined in: [mdast-util-to-pdf.ts:194](https://github.com/inokawa/remark-pdf/blob/e73b7632f858e9881de3e62c7c6e8051f5a5640b/src/mdast-util-to-pdf.ts#L194)

Standard fonts or privided custom fonts.

#### Default

```ts
"Helvetica"
```

***

### size?

> `optional` **size**: `"A0"` \| `"A1"` \| `"A2"` \| `"A3"` \| `"A4"` \| `"A5"` \| `"A6"` \| `"A7"` \| `"A8"` \| `"A9"` \| `"A10"` \| `"B0"` \| `"B1"` \| `"B2"` \| `"B3"` \| `"B4"` \| `"B5"` \| `"B6"` \| `"B7"` \| `"B8"` \| `"B9"` \| `"B10"` \| `"C0"` \| `"C1"` \| `"C2"` \| `"C3"` \| `"C4"` \| `"C5"` \| `"C6"` \| `"C7"` \| `"C8"` \| `"C9"` \| `"C10"`

Defined in: [mdast-util-to-pdf.ts:200](https://github.com/inokawa/remark-pdf/blob/e73b7632f858e9881de3e62c7c6e8051f5a5640b/src/mdast-util-to-pdf.ts#L200)

Page size.
https://pdfkit.org/docs/paper_sizes.html

#### Default

```ts
A4
```

***

### margin?

> `optional` **margin**: `number` \| \{ `top?`: `number`; `left?`: `number`; `bottom?`: `number`; `right?`: `number`; \}

Defined in: [mdast-util-to-pdf.ts:238](https://github.com/inokawa/remark-pdf/blob/e73b7632f858e9881de3e62c7c6e8051f5a5640b/src/mdast-util-to-pdf.ts#L238)

Page margin.

#### Default

```ts
40
```

***

### orientation?

> `optional` **orientation**: `"portrait"` \| `"landscape"`

Defined in: [mdast-util-to-pdf.ts:245](https://github.com/inokawa/remark-pdf/blob/e73b7632f858e9881de3e62c7c6e8051f5a5640b/src/mdast-util-to-pdf.ts#L245)

Page orientation.

#### Default

```ts
"portrait"
```

***

### spacing?

> `optional` **spacing**: `number`

Defined in: [mdast-util-to-pdf.ts:250](https://github.com/inokawa/remark-pdf/blob/e73b7632f858e9881de3e62c7c6e8051f5a5640b/src/mdast-util-to-pdf.ts#L250)

Spacing after Paragraphs.

#### Default

```ts
undefined
```

***

### styles?

> `optional` **styles**: `Partial`\<`StyleOption`\> & `object`

Defined in: [mdast-util-to-pdf.ts:254](https://github.com/inokawa/remark-pdf/blob/e73b7632f858e9881de3e62c7c6e8051f5a5640b/src/mdast-util-to-pdf.ts#L254)

Styles that override the defaults.

#### Type Declaration

##### default?

> `optional` **default**: `Partial`\<`TextStyle`\>

***

### textStyle?

> `optional` **textStyle**: `TextStyleMatcher`[]

Defined in: [mdast-util-to-pdf.ts:258](https://github.com/inokawa/remark-pdf/blob/e73b7632f858e9881de3e62c7c6e8051f5a5640b/src/mdast-util-to-pdf.ts#L258)

An option to find text and apply style (e.g. font to emoji)

***

### loadImage?

> `optional` **loadImage**: `LoadImageFn`

Defined in: [mdast-util-to-pdf.ts:263](https://github.com/inokawa/remark-pdf/blob/e73b7632f858e9881de3e62c7c6e8051f5a5640b/src/mdast-util-to-pdf.ts#L263)

A function to resolve image data from url.

#### Default

loadWithFetch
