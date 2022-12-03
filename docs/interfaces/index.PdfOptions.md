# Interface: PdfOptions

[index](../modules/index.md).PdfOptions

## Hierarchy

- `Pick`<`TDocumentDefinitions`, ``"pageMargins"`` \| ``"pageOrientation"`` \| ``"pageSize"`` \| ``"userPassword"`` \| ``"ownerPassword"`` \| ``"permissions"`` \| ``"version"`` \| ``"watermark"``\>

  ↳ **`PdfOptions`**

## Table of contents

### Properties

- [output](index.PdfOptions.md#output)
- [imageResolver](index.PdfOptions.md#imageresolver)
- [info](index.PdfOptions.md#info)
- [pageMargins](index.PdfOptions.md#pagemargins)
- [pageOrientation](index.PdfOptions.md#pageorientation)
- [pageSize](index.PdfOptions.md#pagesize)
- [userPassword](index.PdfOptions.md#userpassword)
- [ownerPassword](index.PdfOptions.md#ownerpassword)
- [permissions](index.PdfOptions.md#permissions)
- [version](index.PdfOptions.md#version)
- [watermark](index.PdfOptions.md#watermark)

## Properties

### output

• `Optional` **output**: ``"buffer"`` \| ``"blob"``

Set output type of `VFile.result`. `buffer` is `Promise<Buffer>`. `blob` is `Promise<Blob>`.

**`Default Value`**

"buffer"

#### Defined in

[src/transformer.ts:64](https://github.com/inokawa/remark-pdf/blob/137a4eb/src/transformer.ts#L64)

___

### imageResolver

• `Optional` **imageResolver**: `ImageResolver`

**You must set** if your markdown includes images.

#### Defined in

[src/transformer.ts:68](https://github.com/inokawa/remark-pdf/blob/137a4eb/src/transformer.ts#L68)

___

### info

• `Optional` **info**: `TDocumentInformation`

#### Defined in

[src/transformer.ts:69](https://github.com/inokawa/remark-pdf/blob/137a4eb/src/transformer.ts#L69)

___

### pageMargins

• `Optional` **pageMargins**: `Margins`

#### Inherited from

Pick.pageMargins

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:426

___

### pageOrientation

• `Optional` **pageOrientation**: `PageOrientation`

#### Inherited from

Pick.pageOrientation

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:427

___

### pageSize

• `Optional` **pageSize**: `PageSize`

#### Inherited from

Pick.pageSize

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:428

___

### userPassword

• `Optional` **userPassword**: `string`

#### Inherited from

Pick.userPassword

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:430

___

### ownerPassword

• `Optional` **ownerPassword**: `string`

#### Inherited from

Pick.ownerPassword

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:431

___

### permissions

• `Optional` **permissions**: `DocumentPermissions`

#### Inherited from

Pick.permissions

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:432

___

### version

• `Optional` **version**: `PDFVersion`

#### Inherited from

Pick.version

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:433

___

### watermark

• `Optional` **watermark**: `string` \| `Watermark`

#### Inherited from

Pick.watermark

#### Defined in

node_modules/@types/pdfmake/interfaces.d.ts:434
