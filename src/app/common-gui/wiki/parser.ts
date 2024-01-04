import { consumeUntil, consumePlain, consumeWhile, consume } from './parser-basic';
import { SimpleDetector, SpecialCharDetector } from './parser-detectors';
import { AllowedElements, IsAllowedElement, Content, createElementOf } from './parser-elements';

export function parser(str: string): Content[] {
    let content: Content[] = [];

    let queue: string[] = Array.from(str);

    let plainTextBuffer: string = '';

    while (queue.length > 0) {
        // Consume until next special char
        let { buffer: plainBuffer, trigger } = consumeUntil(
            queue,
            SpecialCharDetector
        );

        plainTextBuffer += plainBuffer;

        if (queue[0] === '\\') {
            queue.shift();
            plainTextBuffer += queue.shift();
        }

        let { detected, buffer, extra, content: inner } = IsAllowedElement(queue.slice());

        let [detector, params] = extra ?? [];

        if (detected && detector !== undefined && buffer !== undefined) {
            // Add plain text buffer
            if (plainTextBuffer !== '') {
                content.push(plainTextBuffer);

                plainTextBuffer = '';
            }

            // Consume detected element
            consume(queue, detector);

            // Create element
            content.push(
                createElementOf(
                    detector,
                    inner == undefined ? [''] : parser(inner),
                    params
                )
            );
        } else {
            plainTextBuffer += queue.shift() ?? '';
        }
    }

    // Add plain text buffer
    if (plainTextBuffer !== '') {
        content.push(plainTextBuffer);
    }

    // Filter out all strings that can be trimmed to ''
    content = content.filter((c) => {
        if (typeof c === 'string') {
            return c.trim() !== '';
        }

        return true;
    });

    return content;
}

export { Content, AllowedElements } from './parser-elements';