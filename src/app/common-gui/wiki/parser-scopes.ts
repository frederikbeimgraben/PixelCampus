// Scopes Parser
import { consumeUntil, consumePlain, consumeWhile, trim, consume, consumeWhileWithResults, ConsumptionError } from './parser-basic';
import { ConsumptionResult, Detector, Any, Invert, SimpleDetector, SpecialCharDetector, WhitespaceDetector, IdentifierDetector, Reverse } from './parser-detectors';
import { TagDetector } from './parser-tags';

export class ScopeError extends Error { }

export function consumeScope(queue: string[], startDetector: Detector, endDetector: Detector): ConsumptionResult<string> {
    // Shift start
    let whole;
    try {
        whole = consume(queue, startDetector).trigger;
    } catch (e) {
        if (e instanceof ConsumptionError) {
            throw new ScopeError(`Scope for "${queue.slice(0, 10).join('')}" not found!`);
        }

        throw e;
    }

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

        whole += buffer;

        if (startDetector(queue).detected && !endDetector(queue).detected) {
            let result = consume(queue, startDetector).buffer;
            whole += result;
            buffer += result;
            scope++;
        } else if (endDetector(queue).detected) {
            scope--;

            if (scope === 0) {
                whole += consume(queue, endDetector).buffer;
                closing = extra as string;
            } else {
                let result = consume(queue, endDetector).buffer;
                whole += result;
                buffer += result;
            }
        }

        content += buffer;
    }

    return {
        trigger: whole,
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
