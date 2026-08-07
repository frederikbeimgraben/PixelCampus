import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { ContractRouterClient } from '@orpc/contract';
import { InjectionToken, inject } from '@angular/core';
import { API_BASE_PATH, contract } from '@pixelcampus/contract';

import { API_CONFIG } from './api-config';

/** The API, typed from the shared contract. */
export type ApiClient = ContractRouterClient<typeof contract>;

/**
 * Injected rather than constructed at each call site, so tests can supply a
 * different base URL or a stub.
 */
export const API_CLIENT = new InjectionToken<ApiClient>('API_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const config = inject(API_CONFIG);

    /*
     * OpenAPILink calls the contract's declared REST paths, so requests look
     * like ordinary GETs and the responses are validated against the same
     * schemas the API implements. A field the API stops sending fails here
     * rather than rendering as a blank panel.
     */
    const link = new OpenAPILink(contract, {
      url: `${config.statsBaseUrl}${API_BASE_PATH}`,
    });

    return createORPCClient(link);
  },
});
