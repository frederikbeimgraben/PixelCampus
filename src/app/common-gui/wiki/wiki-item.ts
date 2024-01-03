/* 
    This class is used to store the data of a wiki item.
    It is used in the wiki component to display the wiki items.
*/


// Standard HTML Elements
export type HTMLTag = 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export type Tag = HTMLTag | 'button' | 'popup';

export interface Extra {
    tag: Tag;
    content?: string[] | Content[];
    style?: string;
    properties?: { [key: string]: string };
}

export type Content = string | Extra;

function consumeUntil(queue: string[], ...chars: string[]): string {
    let result: string = '';
    let current: string | undefined = queue.shift();

    while (current !== undefined) {
        if (chars.includes(current!)) {
            // Readd char to queue
            queue.unshift(current!);
            break;
        }

        result += current;
        current = queue.shift();
    }

    return result;
}

function consumeUntilBreakOn(queue: string[], breakOn: string, ...chars: string[]): string {
    let result: string = '';
    let current: string | undefined = queue.shift();

    while (current !== undefined) {
        if (chars.includes(current!)) {
            // Readd char to queue
            queue.unshift(current!);
            break;
        }

        if (current === breakOn) {
            break;
        }

        result += current;
        current = queue.shift();
    }

    return result;
}

function consumeWhile(queue: string[], ...chars: string[]): string {
    let result: string = '';
    let current: string | undefined = queue.shift();

    while (current !== undefined) {
        if (!chars.includes(current!)) {
            // Readd char to queue
            queue.unshift(current!);
            break;
        }

        result += current;
        current = queue.shift();

        // Consume escaped char
        if (current === '\\') {
            result += queue.shift();
        }
    }

    return result;
}

const SpecialChars: string[] = ['*', '#', '[', ']', '(', ')', '!', '<' , '>'];

function consumePlain(queue: string[]): string {
    // Consume until next special char
    let result: string = consumeUntil(queue, ...SpecialChars);

    return result;
}

function trimStart(queue: string[]) {
    consumeWhile(queue, ' ');
}

function detectOpeningTag(queue: string[], tagName: string, consume: boolean=false): string | false {
    if (!consume)
        queue = queue.slice();

    let result: string = '';

    // Check if the Tag starts at the beginning of the queue
    if (queue[0] !== '<') {
        return false;
    }

    // Consume tag name
    let inner = consumeScope(queue, '<', '>');
    let tagNamePlain = consumePlain(
        Array.from(consumeUntilBreakOn(Array.from(inner), '>', ' '))
    );

    if (tagNamePlain !== tagName) {
        // Invalid tag
        return false;
    }

    result += inner;

    // Consume '>'
    result += queue.shift();

    return result;
}

function detectClosingTag(queue: string[], tagName: string, consume: boolean=false): string | false {
    if (!consume)
        queue = queue.slice();

    let result: string = '';

    // Check if the Tag starts at the beginning of the queue
    if (queue[0] !== '<' || queue[1] !== '/') {
        return false;
    }

    // Consume tag name
    let inner = consumeScope(queue, '</', '>');
    let tagNamePlain = consumePlain(
        Array.from(consumeUntilBreakOn(Array.from(inner), '>', ' ', '>'))
    );

    console.log(`<${tagNamePlain}> vs <${tagName}>`);

    if (tagNamePlain !== tagName) {
        // Invalid tag
        return false;
    }

    result += inner;

    // Consume '>'
    result += queue.shift();

    return result;
}

function consumeScope(queue: string[], start: string, end: string): string {
    // Consume whole scope by using two sliding windows and counting the number of start and end chars
    let result: string = '';

    let startWidth: number = start.length;
    let endWidth: number = end.length;

    function startWindow(): string {
        return queue.slice(
            0,
            Math.min(
                startWidth,
                queue.length
            )
        ).join('');
    }

    function endWindow(): string {
        return queue.slice(
            0,
            Math.min(
                endWidth,
                queue.length
            )
        ).join('');
    }

    let scope: number = 1;

    if (start !== startWindow()) {
        // Invalid start
        throw new Error(`Invalid Start: "${start}" "${startWindow()}" "${queue.slice(0, 10).join('')}"`);
    }

    for (let i = 0; i < startWidth; i++) {
        queue.shift();
    }

    while (queue.length > 0) {
        if (start == startWindow() && start !== end) {
            scope++;
        }

        if (end == endWindow()) {
            scope--;
        }

        if (scope > 0) {
            result += queue.shift();
        } else {
            for (let i = 0; i < endWidth; i++) {
                queue.shift();
            }

            break;
        }
    }

    if (scope > 0) {
        // Invalid scope
        console.log('Unterminated Scope for ' + start + ' ' + end);
        return result + `[ Unterminated Scope for ${start} ${end} ]`;
    }

    return result;
}

function consumeTagScope(queue: string[], tagName: string): string {
    let result: string = '';

    let index: number = 0;

    let scope: number = 1;

    if (!detectOpeningTag(queue, tagName, true)) {
        // Invalid start
        throw new Error(`Invalid Tag Start for ${tagName}: "${queue.slice(0, 10).join('')}"`);
    }

    while (queue.length > 0) {
        if (detectClosingTag(queue, tagName)) {
            scope--;
        }
        if (detectOpeningTag(queue, tagName)) {
            scope++;
        }

        if (scope > 0) {
            result += queue.shift();
        } else {
            detectClosingTag(queue, tagName, true);

            break;
        }
    }

    if (scope > 0) {
        // Invalid scope
        console.log('Unterminated Scope for ' + tagName);
        return result + `[ Unterminated Scope for ${tagName} ]`;
    }

    return result;
}

const AllowedTags: string[] = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'card'];

function parseHeader(queue: string[]): Content {
    let counter: number = 0;

    // Count number of #s by consuming until next char is not #
    counter = consumeWhile(queue, '#').length;
    counter = Math.min(counter, 6);

    // Consume spaces
    trimStart(queue);

    let tag: Content = {
        tag: `h${counter}` as Tag,
        content: parse(
            consumeUntil(queue, '\n')
        )
    };

    return tag;
}

function parseFontStyle(queue: string[]): Content {
    let counter: number = 0;

    // Count number of *s by consuming until next char is not *
    counter = consumeWhile(queue.slice(), '*').length;

    let style = '';

    switch (counter) {
        case 1:
            style = 'font-style: Minecraft Italic;';
            break;
        case 2:
            style = 'font-family: Minecraft Bold;';
            break;
        case 3:
            style = 'font-family: Minecraft Bold Italic;';
            break;
        default:
            style = 'font-family: Minecraft Bold Italic;';
            break;
    }

    // Consume Content
    let content = parse(
        consumeScope(queue, '*'.repeat(counter), '*'.repeat(counter))
    );

    let tag: Content = {
        tag: 'span' as Tag,
        content: content,
        style: style
    };

    return tag;
}

function parseLink(queue: string[]): Content {
    let linkDisplayContent = consumeScope(queue, '[', ']');

    // Consume spaces
    trimStart(queue);

    if (queue[0] !== '(') {
        // Invalid link
        queue.shift();

        return `[invalid link]`;
    }

    // Consume '(' Scope
    let linkRef = consumeScope(queue, '(', ')');
    linkRef = consumePlain(Array.from(linkRef));

    let link: Content = {
        tag: 'a' as Tag,
        content: parse(
            linkDisplayContent
        ),
        properties: {
            href: linkRef
        }
    };

    return link;
}

function parseImage(queue: string[]): Content {
    // Consume '!'
    queue.shift();

    let imageAlt = consumeScope(queue, '[', ']')
    imageAlt = consumePlain(Array.from(imageAlt));

    // Consume spaces
    trimStart(queue);

    if (queue[0] !== '(') {
        // Invalid link

        return `[invalid image]`;
    }

    // Consume '(' Scope
    let imageRef = consumeScope(queue, '(', ')');
    imageRef = consumePlain(Array.from(imageRef));

    let image: Content = {
        tag: 'img' as Tag,
        content: [],
        properties: {
            src: imageRef,
            alt: imageAlt
        }
    };

    return image;
}

function parseTag(queue: string[]): Content {
    try {
        // Get Tag name
        // Copy queue to prevent consuming
        let queueCopy = queue.slice();

        let tagName = consumeScope(queueCopy, '<', '>');
        let tagNamePlain = consumePlain(
            Array.from(consumeUntilBreakOn(Array.from(tagName), '>', ' ')),
        );

        let properties: { [key: string]: string } = {};

        if (tagNamePlain !== tagName) {
            // Extract properties
            // Consume tag name
            let innerQueue = Array.from(tagName);

            consumeUntil(innerQueue, ' ');

            while (innerQueue.length > 0) {
                // Consume spaces
                trimStart(innerQueue);

                let propertyName = consumePlain(
                    Array.from(consumeUntilBreakOn(innerQueue, '>', '='))
                );

                // Consume spaces
                trimStart(innerQueue);

                if (innerQueue[0] !== '=') {
                    // Invalid property
                    break;
                }

                // Consume '='
                innerQueue.shift();

                // Consume spaces
                trimStart(innerQueue);

                let propertyValue = consumeScope(innerQueue, '"', '"');

                properties[propertyName] = propertyValue;
            }
        }
        
        if (AllowedTags.includes(tagNamePlain)) {
            // Consume spaces
            trimStart(queue);

            let tagContent = consumeTagScope(
                queue,
                tagNamePlain
            );

            let tag: Content = {
                tag: tagNamePlain as Tag,
                content: parse(tagContent),
                properties: properties
            };

            return tag;
        } else {
            return `[invalid tag]`;
        }
    } catch (e) {
        while (queue.length > 0) {
            queue.shift();
        }

        return `[invalid tag: ${e}]`;
    }
}

function cleanBuffer(buffer: string): string | undefined {
    let result: string = '';

    let bufferQueue = Array.from(buffer);

    trimStart(bufferQueue);
    consumeWhile(bufferQueue, '\n');

    result = bufferQueue.join('');

    return result.length > 0 ? result : undefined;
}

export function parse(str: string): Content[] {
    let content: Content[] = [];

    let queue: string[] = Array.from(str);

    let buffer = '';

    // Consume leading spaces and newlines
    trimStart(queue);
    consumeWhile(queue, '\n');

    while (queue.length > 0) {
        buffer += consumePlain(queue);

        buffer = cleanBuffer(buffer) ?? '';

        if (buffer.length > 0) {
            content.push(buffer);
            buffer = '';
        }

        let char: string | undefined = queue[0]

        switch (char) {
            case '#':
                content.push(
                    parseHeader(queue)
                );

                continue;
            case '*':
                content.push(
                    parseFontStyle(queue)
                );

                continue;
            case '[':
                content.push(
                    parseLink(queue)
                );

                continue;
            case '!':
                content.push(
                    parseImage(queue)
                );

                continue;
            case '<':
                content.push(
                    parseTag(queue)
                );

                continue;
            case undefined:
                break;
        }
    }

    buffer = cleanBuffer(buffer) ?? '';

    if (buffer.length > 0) {
        content.push(buffer);
    }

    content = content.filter((item) => typeof item !== 'string' || cleanBuffer(item) !== undefined);

    return content;
}

export class WikiItem {
    // Replaces NavigatorItem
    id: number | string;
    title_str: string;
    icon: string;
    index: number;
    active: boolean = false;
    content: string;
  
    constructor(id: number | string, index: number, title_str: string, active?: boolean, icon?: string, content?: string) {
      this.id = id;
      this.title_str = title_str;
      this.index = index;
      this.active = active || false;
      this.icon = icon || '/assets/items/compass_01.png';
      this.content = content || '';
    }
  
    get icon_str(): string {
      return this.icon;
    }
  
    get title(): string {
      return this.title_str || '';
    }
  }