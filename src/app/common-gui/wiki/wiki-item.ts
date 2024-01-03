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

function consumeScope(queue: string[], start: string, end: string): string {
    // Consume whole scope by using two sliding windows and counting the number of start and end chars
    let result: string = '';
    
    let index: number = 0;

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

    if (startWindow() !== start) {
        // Invalid start
        throw new Error('Invalid Start');
    }

    for (let i = 0; i < startWidth; i++) {
        queue.shift();
    }

    while (queue.length > 0) {
        if (startWindow() === start && start !== end) {
            scope++;
        }

        if (endWindow() === end) {
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

const AllowedTags: string[] = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'popup'];

export function parse(str: string): Content[] {
    let content: Content[] = [];

    let queue: string[] = Array.from(str);

    let counter: number = 0;

    let buffer = '';

    // Consume leading spaces and newlines
    trimStart(queue);
    consumeWhile(queue, '\n');

    while (queue.length > 0) {
        buffer += consumePlain(queue);

        if (buffer.length > 0) {
            let bufferQueue = Array.from(buffer);

            trimStart(bufferQueue);
            consumeWhile(bufferQueue, '\n');

            buffer = bufferQueue.join('');

            if (buffer.length > 0) {
                content.push(buffer);
                buffer = '';
            }
        }

        let char: string | undefined = queue[0]

        switch (char) {
            case '#':
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

                content.push(tag);

                continue;
            case '*':
                let spanContent;
                let spanStyle = '';

                if (queue.length > 1 && queue[1] === '*') {
                    if (queue.length > 2 && queue[2] === '*') {
                        counter = 3;
                        while (queue.length > counter && queue[counter] === '*') {
                            counter++;
                        }

                        spanContent = parse(
                            consumeScope(queue, '*'.repeat(counter), '*'.repeat(counter))
                        );
                        spanStyle = 'font-family: Minecraft Bold Italic;';

                    } else {
                        spanContent = parse(
                            consumeScope(queue, '**', '**')
                        );
                        spanStyle = 'font-family: Minecraft Bold;';
                    }
                }
                else {
                    spanContent = parse(
                        consumeScope(queue, '*', '*')
                    );
                    spanStyle = 'font-style: italic;';
                }

                let span: Content = {
                    tag: 'span' as Tag,
                    content: spanContent,
                    style: spanStyle
                };

                content.push(span);

                continue;
            case '[':
                let _linkDisplayContent = consumeScope(queue, '[', ']');

                let linkDisplayContent = parse(
                    _linkDisplayContent
                );

                // Consume spaces
                trimStart(queue);

                if (queue[0] !== '(') {
                    // Invalid link
                    queue.shift();

                    buffer += '[invalid link]';
                
                    continue;
                }

                // Consume '(' Scope
                let linkRef = consumeScope(queue, '(', ')');
                linkRef = consumePlain(Array.from(linkRef));

                let link: Content = {
                    tag: 'a' as Tag,
                    content: linkDisplayContent,
                    properties: {
                        href: linkRef
                    }
                };

                content.push(link);

                continue;
            case '!':
                if (queue.length > 1 && queue[1] === '[') {
                    // Consume '!'
                    queue.shift();

                    let imageAlt = consumeScope(queue, '[', ']')
                    imageAlt = consumePlain(Array.from(imageAlt));

                    // Consume spaces
                    trimStart(queue);

                    if (queue[0] !== '(') {
                        // Invalid link

                        buffer += '[invalid image]';

                        continue;
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

                    content.push(image);
                } else {
                    buffer += char;
                }

                continue;
            case '<':
                try {
                    // Get Tag name
                    // Copy queue to prevent consuming
                    let queueCopy = queue.slice();

                    let tagName = consumeScope(queueCopy, '<', '>');
                    let tagNamePlain = consumePlain(Array.from(tagName));

                    if (tagNamePlain !== tagName) {
                        // Invalid Tag
                        buffer += '[ Invalid Tag: ' + tagName + ' ]';
                        continue;
                    }

                    if (AllowedTags.includes(tagName)) {
                        // Consume spaces
                        trimStart(queue);

                        let tagContent = consumeScope(
                            queue,
                            `<${tagName}>`,
                            `</${tagName}>`
                        );

                        let tag: Content = {
                            tag: tagName as Tag,
                            content: parse(tagContent)
                        };

                        content.push(tag);
                    } else {
                        // Invalid Tag
                        buffer += '[ Disallowed Tag: ' + tagName + ' ]';

                        // Consume Tag
                        buffer += consumeScope(queue, `<${tagName}>`, `</${tagName}>`);
                    }

                    continue;
                } catch (e) {
                    console.log("Error while parsing tag:", e);
                    buffer += `[ Error while parsing tag: ${e} ]`;

                    while (queue.length > 0) {
                        buffer += queue.shift();
                    }
                    break;
                }
            case undefined:
                break;
            default:
                buffer += char;
                break;
        }
    }

    let bufferQueue = Array.from(buffer);

    trimStart(bufferQueue);
    consumeWhile(bufferQueue, '\n');

    buffer = bufferQueue.join('');

    if (buffer.length > 0) {
        content.push(buffer);
    }

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