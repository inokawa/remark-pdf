# Interface: PdfOptions

[index](../modules/index.md).PdfOptions

## Hierarchy

- `Pick`<`TDocumentDefinitions`, ``"defaultStyle"`` \| ``"pageMargins"`` \| ``"pageOrientation"`` \| ``"pageSize"`` \| ``"userPassword"`` \| ``"ownerPassword"`` \| ``"permissions"`` \| ``"version"`` \| ``"styles"`` \| ``"watermark"``\>

  ↳ **`PdfOptions`**

## Table of contents

### Properties

- [output](index.PdfOptions.md#output)
- [imageResolver](index.PdfOptions.md#imageresolver)
- [info](index.PdfOptions.md#info)
- [fonts](index.PdfOptions.md#fonts)
- [defaultStyle](index.PdfOptions.md#defaultstyle)
- [pageMargins](index.PdfOptions.md#pagemargins)
- [pageOrientation](index.PdfOptions.md#pageorientation)
- [pageSize](index.PdfOptions.md#pagesize)
- [userPassword](index.PdfOptions.md#userpassword)
- [ownerPassword](index.PdfOptions.md#ownerpassword)
- [permissions](index.PdfOptions.md#permissions)
- [version](index.PdfOptions.md#version)
- [styles](index.PdfOptions.md#styles)
- [watermark](index.PdfOptions.md#watermark)

## Properties

### output

• `Optional` **output**: ``"buffer"`` \| ``"blob"``

Set output type of `VFile.result`. `buffer` is `Promise<Buffer>`. `blob` is `Promise<Blob>`.

**`Default Value`**

```ts
"buffer"
```

#### Defined in

[src/transformer.ts:68](https://github.com/zetlen/remark-pdf/blob/6e30eb7/src/transformer.ts#L68)

___

### imageResolver

• `Optional` **imageResolver**: `ImageResolver`

**You must set** if your markdown includes images.

#### Defined in

[src/transformer.ts:72](https://github.com/zetlen/remark-pdf/blob/6e30eb7/src/transformer.ts#L72)

___

### info

• `Optional` **info**: `TDocumentInformation`

#### Defined in

[src/transformer.ts:73](https://github.com/zetlen/remark-pdf/blob/6e30eb7/src/transformer.ts#L73)

___

### fonts

• `Optional` **fonts**: `TFontDictionary`

#### Defined in

[src/transformer.ts:74](https://github.com/zetlen/remark-pdf/blob/6e30eb7/src/transformer.ts#L74)

___

### defaultStyle

• `Optional` **defaultStyle**: `Style`

Default styles that apply to the complete document.

#### Inherited from

Pick.defaultStyle

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:2025

___

### pageMargins

• `Optional` **pageMargins**: `Margins`

Margins around the content on each page.

If a header or footer is specified, the page margins must
leave sufficient room for it to be rendered at all.

Defaults to `40`.

#### Inherited from

Pick.pageMargins

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:2094

___

### pageOrientation

• `Optional` **pageOrientation**: `PageOrientation`

Orientation of the document's pages.

Defaults to `portrait` for standard page sizes; if a custom [pageSize](index.PdfOptions.md#pagesize) is given,
it defaults to the orientation set through its width and height.

#### Inherited from

Pick.pageOrientation

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:2102

___

### pageSize

• `Optional` **pageSize**: `PageSize`

Size of the document's pages.

Defaults to `A4`.

#### Inherited from

Pick.pageSize

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:2109

___

### userPassword

• `Optional` **userPassword**: `string`

Password required to open the document.

If set, the document is encrypted.
Setting the [version](index.PdfOptions.md#version) influences the encryption method used.

An empty string is treated as "no password".

#### Inherited from

Pick.userPassword

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:2126

___

### ownerPassword

• `Optional` **ownerPassword**: `string`

Password required to get full access to the document.

Use in combination with [permissions](index.PdfOptions.md#permissions).

An empty string is treated as "no password".

Does not encrypt the document; use [userPassword](index.PdfOptions.md#userpassword) for that.

#### Inherited from

Pick.ownerPassword

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:2137

___

### permissions

• `Optional` **permissions**: `DocumentPermissions`

Permissions for accessing or modifying the document in different ways.

The PDF file cannot enforce these permissions by itself.
It relies on PDF viewer applications to respect them.

Only relevant if [ownerPassword](index.PdfOptions.md#ownerpassword) is set.

Defaults to `{}` (everything is forbidden)

#### Inherited from

Pick.permissions

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:2149

___

### version

• `Optional` **version**: `PDFVersion`

Version of the PDF specification the document is created with.

Influences the encryption method used in combination with [userPassword](index.PdfOptions.md#userpassword).
The PDF content is always created with version 1.3.

Defaults to `1.3`.

#### Inherited from

Pick.version

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:2159

___

### styles

• `Optional` **styles**: `StyleDictionary`

Dictionary for reusable styles to be referenced by their key throughout the document.

To define styles that should apply by default, use defaultStyles instead.

#### Inherited from

Pick.styles

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:2116

___

### watermark

• `Optional` **watermark**: `string` \| `Watermark`

Watermark that is rendered on top of each page.

#### Inherited from

Pick.watermark

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:2183
