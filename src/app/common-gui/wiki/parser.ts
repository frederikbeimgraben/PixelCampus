import { consumeUntil, consumePlain, consumeWhile, consume } from './parser-basic';
import { SimpleDetector, SpecialCharDetector } from './parser-detectors';
import { AllowedElements, IsAllowedElement, Content } from './parser-elements';

export function parser(str: string): Content[] {
    let content: Content[] = [];

    let queue: string[] = Array.from(str);

    while (queue.length > 0) {

        // Consume until next special char
        let { buffer: plainBuffer, trigger } = consumeUntil(
            queue,
            SpecialCharDetector
        );

        if (plainBuffer.length > 0) {
            content.push(plainBuffer);
        }

        let { detected, buffer, extra: detector } = IsAllowedElement(queue);

        if (detected && detector !== undefined && buffer !== undefined) {
            // Consume detected element
            consume(queue, SimpleDetector(buffer));

            console.log('Detected element:', detector, buffer);

            // Create element using switch

        }
    }

    return content;
}

export { Content, AllowedElements } from './parser-elements';