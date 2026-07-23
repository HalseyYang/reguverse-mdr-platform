export function nextDraftVersion(history = []) {
  const highest = history.reduce((max, item) => {
    const match = /^v0\.(\d+)$/.exec(item.version ?? '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `v0.${highest + 1}`;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const localParts = [];
  const directoryParts = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBuffer = Buffer.from(name);
    const content = Buffer.from(text);
    const compressed = content;
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    directoryParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  }
  const directory = Buffer.concat(directoryParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, directory, end]);
}

function xmlEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function createRevisionDocx({ title, version, templateMarkdown = '', sections = [], openItems = [] }) {
  if (version === 'v1.0' && (templateMarkdown.includes('[TO BE PROVIDED]') || openItems.length)) {
    const error = new Error('Formal version requires all placeholders and open items to be resolved');
    error.code = 'formal_version_blocked';
    throw error;
  }
  const body = [
    `DRAFT_${version}`,
    title,
    templateMarkdown,
    ...sections.map(({ heading, content }) => `${heading}\n${content}`),
    ...openItems.map((item) => `Bioray: ${item.scene ?? ''} ${item.conflictAndQuestion ?? ''}`)
  ].map(xmlEscape).join('</w:t></w:r><w:r><w:t>');
  const documentXml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${body}</w:t></w:r><w:ins w:author="Bioray" w:id="1"><w:r><w:t>Tracked revision</w:t></w:r></w:ins></w:p></w:body></w:document>`;
  const commentsXml = `<?xml version="1.0" encoding="UTF-8"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="Bioray"><w:p><w:r><w:t>${xmlEscape(openItems.map((item) => item.conflictAndQuestion ?? item.scene ?? '').join('\n'))}</w:t></w:r></w:p></w:comment></w:comments>`;
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', documentXml],
    ['word/comments.xml', commentsXml],
    ['word/_rels/document.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>']
  ]);
}
