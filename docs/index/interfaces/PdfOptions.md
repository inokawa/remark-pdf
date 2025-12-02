[**API**](../../API.md)

***

# Interface: PdfOptions

Defined in: [src/transformer.ts:55](https://github.com/inokawa/remark-pdf/blob/df179a9f25c3f7aa68ab62daa54474119db994ee/src/transformer.ts#L55)

## Extends

- `Pick`\<`TDocumentDefinitions`, `"defaultStyle"` \| `"pageMargins"` \| `"pageOrientation"` \| `"pageSize"` \| `"userPassword"` \| `"ownerPassword"` \| `"permissions"` \| `"version"` \| `"styles"` \| `"watermark"`\>

## Properties

### output?

> `optional` **output**: `"buffer"` \| `"blob"`

Defined in: [src/transformer.ts:73](https://github.com/inokawa/remark-pdf/blob/df179a9f25c3f7aa68ab62daa54474119db994ee/src/transformer.ts#L73)

Set output type of `VFile.result`. `buffer` is `Promise<Buffer>`. `blob` is `Promise<Blob>`.

#### Default Value

```ts
"buffer"
```

***

### imageResolver?

> `optional` **imageResolver**: `ImageResolver`

Defined in: [src/transformer.ts:77](https://github.com/inokawa/remark-pdf/blob/df179a9f25c3f7aa68ab62daa54474119db994ee/src/transformer.ts#L77)

**You must set** if your markdown includes images.

***

### info?

> `optional` **info**: `TDocumentInformation`

Defined in: [src/transformer.ts:78](https://github.com/inokawa/remark-pdf/blob/df179a9f25c3f7aa68ab62daa54474119db994ee/src/transformer.ts#L78)

***

### fonts?

> `optional` **fonts**: `TFontDictionary`

Defined in: [src/transformer.ts:79](https://github.com/inokawa/remark-pdf/blob/df179a9f25c3f7aa68ab62daa54474119db994ee/src/transformer.ts#L79)

***

### preventOrphans?

> `optional` **preventOrphans**: `boolean`

Defined in: [src/transformer.ts:80](https://github.com/inokawa/remark-pdf/blob/df179a9f25c3f7aa68ab62daa54474119db994ee/src/transformer.ts#L80)

***

### defaultStyle?

> `optional` **defaultStyle**: `Style`

Defined in: node\_modules/@types/pdfmake/interfaces.d.ts:2025

Default styles that apply to the complete document.

#### Inherited from

`Pick.defaultStyle`

***

### pageMargins?

> `optional` **pageMargins**: `Margins`

Defined in: node\_modules/@types/pdfmake/interfaces.d.ts:2094

Margins around the content on each page.

If a header or footer is specified, the page margins must
leave sufficient room for it to be rendered at all.

Defaults to `40`.

#### Inherited from

`Pick.pageMargins`

***

### pageOrientation?

> `optional` **pageOrientation**: `PageOrientation`

Defined in: node\_modules/@types/pdfmake/interfaces.d.ts:2102

Orientation of the document's pages.

Defaults to `portrait` for standard page sizes; if a custom [pageSize](#pagesize) is given,
it defaults to the orientation set through its width and height.

#### Inherited from

`Pick.pageOrientation`

***

### pageSize?

> `optional` **pageSize**: `PageSize`

Defined in: node\_modules/@types/pdfmake/interfaces.d.ts:2109

Size of the document's pages.

Defaults to `A4`.

#### Inherited from

`Pick.pageSize`

***

### userPassword?

> `optional` **userPassword**: `string`

Defined in: node\_modules/@types/pdfmake/interfaces.d.ts:2126

Password required to open the document.

If set, the document is encrypted.
Setting the [version](#version) influences the encryption method used.

An empty string is treated as "no password".

#### Inherited from

`Pick.userPassword`

***

### ownerPassword?

> `optional` **ownerPassword**: `string`

Defined in: node\_modules/@types/pdfmake/interfaces.d.ts:2137

Password required to get full access to the document.

Use in combination with [permissions](#permissions).

An empty string is treated as "no password".

Does not encrypt the document; use [userPassword](#userpassword) for that.

#### Inherited from

`Pick.ownerPassword`

***

### permissions?

> `optional` **permissions**: `DocumentPermissions`

Defined in: node\_modules/@types/pdfmake/interfaces.d.ts:2149

Permissions for accessing or modifying the document in different ways.

The PDF file cannot enforce these permissions by itself.
It relies on PDF viewer applications to respect them.

Only relevant if [ownerPassword](#ownerpassword) is set.

Defaults to `{}` (everything is forbidden)

#### Inherited from

`Pick.permissions`

***

### version?

> `optional` **version**: `PDFVersion`

Defined in: node\_modules/@types/pdfmake/interfaces.d.ts:2159

Version of the PDF specification the document is created with.

Influences the encryption method used in combination with [userPassword](#userpassword).
The PDF content is always created with version 1.3.

Defaults to `1.3`.

#### Inherited from

`Pick.version`

***

### styles?

> `optional` **styles**: `StyleDictionary`

Defined in: node\_modules/@types/pdfmake/interfaces.d.ts:2116

Dictionary for reusable styles to be referenced by their key throughout the document.

To define styles that should apply by default, use defaultStyles instead.

#### Inherited from

`Pick.styles`

***

### watermark?

> `optional` **watermark**: `string` \| `Watermark`

Defined in: node\_modules/@types/pdfmake/interfaces.d.ts:2183

Watermark that is rendered on top of each page.

#### Inherited from

`Pick.watermark`
