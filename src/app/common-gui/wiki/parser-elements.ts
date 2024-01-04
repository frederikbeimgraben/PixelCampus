// Actual Allowed Elements
import { ConsumptionError, consume, consumeUntil, consumeWhile } from "./parser-basic";
import { Detector, SimpleDetector, Any, All, Reverse, Invert, DetectorResult } from "./parser-detectors";
import { ScopeDetector, ScopeError, consumeScope } from "./parser-scopes";

import { Property, TagDetector } from "./parser-tags";

// Standard HTML Elements
const allowedTags: string[] = [
    'div',
    'span',
    'p',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'button',
    'card',
    'img',
    'br',
    'a',
    'table', 'tr', 'td', 'th',
    'hr',
];

export type HTMLTag = 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'br' | 'img' | 'a' | 'table' | 'tr' | 'td' | 'th' | 'hr';

export type Tag = HTMLTag | 'button' | 'card';

export interface Extra {
    tag: Tag;
    content?: string[] | Content[];
    style?: string;
    properties?: { [key: string]: string };
}

export type Content = string | Extra;

interface PropertyMap {
    [key: string]: string;
}

export function createElementOf(detector: Detector, content: Content[], extra: any): Content {
    if (typeof content === 'string') {
        return content;
    } else {
        let element: Extra;

        const simple = (tag: Tag, properties?: PropertyMap) => {
            element = {
                tag: tag,
                content: content,
                properties: properties,
            };
        };

        switch (detector) {
            case TagDetector:
                let tagName = extra?.opening?.name;
                
                let properties = extra?.opening?.properties as Property[];

                let propertyMap: { [key: string]: string } = {};

                for (let property of properties) {
                    propertyMap[property.key] = property.value;
                }

                switch (tagName) {
                    case 'button':
                        simple(tagName, propertyMap);
                        break;
                    case 'card':
                        simple(tagName, propertyMap);
                        break;
                    default:
                        if (allowedTags.includes(tagName)) {
                            simple(tagName, propertyMap);
                        } else {
                            console.warn(`Tag ${tagName} is not allowed!`);
                            element = {
                                tag: 'span',
                                content: [`[Tag <${tagName}> is not allowed!]`],
                                properties: {
                                    style: 'color: red;',
                                },
                            };
                        }

                }

                break;
            case HeaderDetector:
                simple(extra);
                break;
            case ImageDetector:
                simple('img', {
                    src: extra,
                });
                break;
            case LinkDetector:
                simple('a', {
                    href: extra,
                });
                break;
            case FontStyleDetectorStar:
                simple('span', extra);
                break;
            default:
                element = {
                    tag: 'span',
                    content: content,
                };
                break;
        }

        return element!;
    }
}

// Detectors
/// Header
export function HeaderDetector(queue: string[]): DetectorResult<string> {
    try {
        let buffer = '';

        let leadingBuffer = consumeWhile(
            queue,
            SimpleDetector('#')
        ).buffer;

        buffer += leadingBuffer ?? '';

        if (leadingBuffer === undefined || leadingBuffer.length === 0) {
            return {
                detected: false,
            };
        }

        // Get count of #
        let count: number = leadingBuffer.length;

        if (count > 6) {
            count = 6;
        }

        // Consume whitespace
        buffer += consumeWhile(
            queue,
            SimpleDetector(' ')
        ).buffer ?? '';

        // Consume until end of line
        let content = consumeUntil(
            queue,
            SimpleDetector('\n')
        ).buffer;

        buffer += content + '\n';

        if (content === undefined) {
            return {
                detected: false,
            };
        }

        return {
            detected: true,
            buffer: buffer,
            content: content.replace('#', '\\#'),
            extra: `h${count}`
        };
    } catch (e) {
        if (e instanceof ConsumptionError || e instanceof ScopeError) {
            return {
                detected: false,
            };
        }

        throw e;
    }
}

/// Image Detector
export function ImageDetector(queue: string[]): DetectorResult<string> {
    try {
        let buffer = '';

        // Consume !
        buffer += consume(
            queue,
            SimpleDetector('!')
        ).buffer ?? '';

        // Consume [] Scope
        let { buffer: contentScope, trigger, content } = consumeScope(
            queue,
            SimpleDetector('['),
            SimpleDetector(']'),
        );

        buffer += contentScope ?? '';

        if (trigger === undefined) {
            return {
                detected: false,
            };
        }

        // Consume () Scope
        let { buffer: linkScope, content: link } = consumeScope(
            queue,
            SimpleDetector('('),
            SimpleDetector(')'),
        );

        buffer += linkScope ?? '';

        return {
            detected: true,
            buffer: buffer,
            content: content,
            extra: link,
        };
    } catch (e) {
        if (e instanceof ConsumptionError || e instanceof ScopeError) {
            return {
                detected: false,
            };
        }

        throw e;
    }
}

/// Link Detector
export function LinkDetector(queue: string[]): DetectorResult<string> {
    try {
        let buffer = '';

        // Consume [] Scope
        let { buffer: contentScope, trigger, content } = consumeScope(
            queue,
            SimpleDetector('['),
            SimpleDetector(']'),
        );

        buffer += contentScope ?? '';

        if (trigger === undefined) {
            return {
                detected: false,
            };
        }

        // Consume () Scope
        let { buffer: linkScope, content: link } = consumeScope(
            queue,
            SimpleDetector('('),
            SimpleDetector(')'),
        );

        buffer += linkScope ?? '';

        return {
            detected: true,
            buffer: buffer,
            content: content,
            extra: link,
        };
    } catch (e) {
        if (e instanceof ConsumptionError || e instanceof ScopeError) {
            return {
                detected: false,
            };
        }

        throw e;
    }
}

/// Italic / Bold / Bold Italic Detector (fontStyleDetector)
export function FontStyleDetectorStar(queue: string[]): DetectorResult<PropertyMap> {
    try {
        // Count of *
        let leading = consumeWhile(
            queue.slice(),
            SimpleDetector('*')
        ).buffer;

        let count = leading?.length ?? 0;

        if (count === 0) {
            return {
                detected: false,
            };
        }

        // Scope
        let { buffer, content } = consumeScope(
            queue,
            SimpleDetector('*'.repeat(count)),
            SimpleDetector('*'.repeat(count), '\n'),
        );

        if (buffer === undefined) {
            return {
                detected: false,
            };
        }

        if (count === 1) {
            return {
                detected: true,
                buffer: buffer,
                content: content,
                extra: {
                    style: 'font-family: Minecraft Italic;',
                },
            };
        } else if (count === 2) {
            return {
                detected: true,
                buffer: buffer,
                content: content,
                extra: {
                    style: 'font-family: Minecraft Bold;',
                },
            };
        } else if (count === 3) {
            return {
                detected: true,
                buffer: buffer,
                content: content,
                extra: {
                    style: 'font-family: Minecraft Bold Italic;',
                },
            };
        } else {
            return {
                detected: true,
                buffer: buffer,
                content: content,
                extra: {
                    style: 'font-family: Minecraft Bold Italic; color: red;',
                },
            };
        }
    } catch (e) {
        if (e instanceof ConsumptionError || e instanceof ScopeError) {
            console.warn('Error', e);

            return {
                detected: false,
            };
        }

        throw e;
    }
}


export const AllowedElements: Detector[] = [
    TagDetector,
    HeaderDetector,
    ImageDetector,
    LinkDetector,
    FontStyleDetectorStar,
]

export function IsAllowedElement(queue: string[]): DetectorResult<[Detector, any]> {
    for (let detector of AllowedElements) {
        let { detected, buffer, content, extra } = detector(queue);

        if (detected) {
            return {
                detected: true,
                buffer: buffer,
                content,
                extra: [
                    detector,
                    extra
                ],
            };
        }
    }

    return {
        detected: false,
    };
}