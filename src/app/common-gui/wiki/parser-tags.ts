import { consume, consumeUntil, consumeWhile, consumeWhileWithResults, trim } from "./parser-basic";
import { IdentifierDetector, SimpleDetector, Detector, DetectorResult, All, Invert, Any } from "./parser-detectors";
import { ScopeDetector, consumeScope } from "./parser-scopes";

export type Property = {
    key: string,
    value: string,
};

export type OpeningTag = {
    name: string,
    properties: Property[],
    isStandalone?: boolean,
};

export type ClosingTag = {
    name: string,
};

export type Tag = {
    opening: OpeningTag,
    content: string,
    closing: ClosingTag,
};

export function TagNameDetector(queue: string[]): DetectorResult<string> {
    let { buffer: tagName, trigger } = consumeWhile(
        queue.slice(),
        IdentifierDetector
    );

    if (trigger === undefined) {
        return {
            detected: false,
        };
    }

    return {
        detected: true,
        buffer: tagName,
    };
}

export function PropertyDetector(queue: string[]): DetectorResult<Property> {
    try {
        queue = queue.slice();

        let buffer = queue.slice().join('');

        // Consume whitespace
        trim(queue);

        let { buffer: key, trigger } = consumeWhile(
            queue,
            IdentifierDetector
        );

        if (trigger === undefined) {
            return {
                detected: false,
            };
        }

        // Consumes whitespace
        trim(queue);

        // Consume =
        consume(queue, SimpleDetector('='));

        // Consumes whitespace
        trim(queue);

        // Consume "" Scope
        let { trigger: end, content: value } = consumeScope(
            queue,
            SimpleDetector('"'),
            SimpleDetector('"'),
        );

        if (end === undefined) {
            return {
                detected: false,
            };
        }

        return {
            detected: true,
            buffer,
            extra: {
                key,
                value,
            } as Property,
        };
    } catch (e) {
        return {
            detected: false,
        };
    }
}

export function OpeningTagDetector(queue: string[]): DetectorResult<OpeningTag> {
    // Detect Scope (<>)
    let { detected: isTagScope, buffer, content, extra: closing } = ScopeDetector(
        All(
            SimpleDetector('<'),
            Invert(
                SimpleDetector('</')
            )
        ),
        SimpleDetector('/>', '>'),
    )(queue.slice());

    if (!isTagScope || buffer === undefined) {
        return {
            detected: false,
        };
    }

    if (content === undefined) {
        return {
            detected: false,
        };
    }

    let tagContent = Array.from(content);

    // Get tag name
    let { detected, buffer: tagName } = TagNameDetector(tagContent);

    if (!detected) {
        return {
            detected: false,
        };
    }

    consume(tagContent, TagNameDetector);

    // Shift whitespace
    trim(tagContent);

    // Get properties
    let results;
    try {
        results = consumeWhileWithResults<Property>(tagContent, PropertyDetector);
    } catch (e) {
        
        return {
            detected: false,
        };
    }

    let properties = results.map(
        result => result.extra
    ).filter(property => property !== undefined) as Property[];

    // Shift whitespace
    trim(tagContent);

    // If the last two characters are "/>", then it's a standalone tag
    let standalone = closing === '/>';

    // Return
    return {
        detected: true,
        buffer: buffer,
        content: content,
        extra: {
            name: tagName,
            properties,
            isStandalone: standalone,
        } as OpeningTag,
    };
}

export function SpecificOpeningTagDetector(tagName: string): Detector<OpeningTag> {
    return (queue: string[]) => {
        let { detected, buffer, extra } = OpeningTagDetector(queue);

        if (!detected || extra === undefined) {
            return {
                detected: false,
            };
        }

        if (extra.name !== tagName) {
            return {
                detected: false,
            };
        }

        return {
            detected: true,
            buffer: buffer,
            extra: extra,
        };
    };
}

export function ClosingTagDetector(openingTag: OpeningTag): Detector<ClosingTag> {
    return (queue: string[]) => {
        let startingTagName = openingTag.name;

        let { detected: isTagScope, buffer, content } = ScopeDetector(
            SimpleDetector('</'),
            SimpleDetector('>'),
        )(queue.slice());
        
        if (content === undefined) {
            return {
                detected: false,
            };
        }

        let inner = Array.from(content);

        if (!isTagScope) {
            
            return {
                detected: false,
            };
        }

        // Get tag name
        let { detected, buffer: tagName } = TagNameDetector(
            inner
        );

        if (!detected || tagName !== startingTagName) {
            return {
                detected: false,
                extra: {
                    name: tagName,
                } as ClosingTag,
            };
        }

        return {
            detected: true,
            buffer: buffer,
            content: content,
            extra: {
                name: tagName,
            } as ClosingTag,
        };
    };
}

export function TagDetector(queue: string[]): DetectorResult<Tag> {
    queue = queue.slice();

    let { detected: hasOpeningTag, buffer: openingBuffer, extra: openingTag } = OpeningTagDetector(queue);

    if (!hasOpeningTag || openingTag === undefined || openingBuffer === undefined) {
        return {
            detected: false,
        };
    }

    if (openingTag.isStandalone) {
        return {
            detected: true,
            buffer: openingBuffer,
            content: '',
            extra: {
                opening: openingTag,
                content: '',
            } as Tag,
        };
    }

    try {
        let { buffer: scopeBuffer, content } = consumeScope(
            queue.slice(),
            SpecificOpeningTagDetector(openingTag.name),
            ClosingTagDetector(openingTag),    
        );

        return {
            detected: true,
            buffer: scopeBuffer,
            content: content,
            extra: {
                opening: openingTag,
                content
            } as Tag,
        };
    } catch (e) {
        console.log(e);

        return {
            detected: false,
        };
    }
}