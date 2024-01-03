// Scopes Parser
import { consumeUntil, consumePlain, consumeWhile, trim, consume, consumeWhileWithResults } from './parser-basic';
import { ConsumptionResult, Detector, Any, Invert, SimpleDetector, SpecialCharDetector, WhitespaceDetector, IdentifierDetector, Reverse } from './parser-detectors';

class ScopeError extends Error { }

export function consumeScope(queue: string[], startDetector: Detector, endDetector: Detector): ConsumptionResult<string> {
    // Shift start
    let whole = consume(queue, startDetector).trigger;
    let content = '';

    let scope = 1;

    let closing: undefined | string = undefined;

    while (scope > 0 && queue.length > 0) {
        let { buffer, trigger, extra } = consumeUntil(
            queue,
            Any(
                startDetector,
                endDetector,
            )
        );

        if (trigger === undefined) {
            throw new ScopeError(`Scope for "${whole}" not closed!`);
        }

        if (startDetector(queue).detected && !endDetector(queue).detected) {
            scope++;
        } else if (endDetector(queue).detected) {
            scope--;
            closing = extra as string;
        }

        whole += buffer + trigger;
        content += buffer;
    }

    let endTrigger = consume(queue, endDetector).trigger!;

    return {
        trigger: endTrigger,
        buffer: whole ?? '',
        content: content ?? '',
        extra: closing,
    };
}

export function ScopeDetector(startDetector: Detector, endDetector: Detector): Detector<string> {
    return (queue: string[]) => {
        queue = queue.slice();

        try {
            let { buffer, trigger, content, extra } = consumeScope(
                queue,
                startDetector,
                endDetector,
            );

            return {
                detected: true,
                buffer,
                content,
                extra,
            };
        } catch (e) {
            if (e instanceof ScopeError) {
                return {
                    detected: false,
                };
            }

            throw e;
        }
    };
}
