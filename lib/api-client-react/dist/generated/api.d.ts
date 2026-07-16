import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { ActivityItem, AssignScreenToGroupBody, AuthUserEnvelope, BeginBrowserLoginParams, BroadcastInput, BroadcastResult, Client, ClientInput, ClientUpdate, CreateEmergencyAlertBody, CreateScreenGroupBody, DashboardStats, EmergencyAlert, ErrorEnvelope, GetReportPeriodSummary200, GetReportPeriodSummaryParams, HealthStatus, ListMediaParams, ListPlayHistory200, ListPlayHistoryParams, ListPlaylistsParams, ListSchedulesParams, ListScreensParams, LogoutSuccess, MediaFile, MediaInput, MobileTokenExchangeRequest, MobileTokenExchangeSuccess, PairScreenInput, PairScreenResult, PlayEvent, PlayerPayload, Playlist, PlaylistDetail, PlaylistInput, PlaylistItem, PlaylistItemInput, PlaylistUpdate, PublishPlaylist200, PushPlaylistToGroup200, PushPlaylistToGroupBody, ReorderPlaylistItems200, ReorderPlaylistItemsBody, ReportSummary, Schedule, ScheduleInput, ScheduleUpdate, Screen, ScreenGroup, ScreenInput, ScreenUpdate, UnassignScreenFromGroupBody, UpdateMediaBody, UpdatePlaylistItemBody, UpdateScreenGroupBody, UploadUrlRequest, UploadUrlResponse } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getGetCurrentAuthUserUrl: () => string;
/**
 * @summary Get the currently authenticated user
 */
export declare const getCurrentAuthUser: (options?: RequestInit) => Promise<AuthUserEnvelope>;
export declare const getGetCurrentAuthUserQueryKey: () => readonly ["/api/auth/user"];
export declare const getGetCurrentAuthUserQueryOptions: <TData = Awaited<ReturnType<typeof getCurrentAuthUser>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCurrentAuthUser>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCurrentAuthUser>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCurrentAuthUserQueryResult = NonNullable<Awaited<ReturnType<typeof getCurrentAuthUser>>>;
export type GetCurrentAuthUserQueryError = ErrorType<unknown>;
/**
 * @summary Get the currently authenticated user
 */
export declare function useGetCurrentAuthUser<TData = Awaited<ReturnType<typeof getCurrentAuthUser>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCurrentAuthUser>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getBeginBrowserLoginUrl: (params?: BeginBrowserLoginParams) => string;
/**
 * @summary Start the browser OIDC login flow
 */
export declare const beginBrowserLogin: (params?: BeginBrowserLoginParams, options?: RequestInit) => Promise<unknown>;
export declare const getBeginBrowserLoginQueryKey: (params?: BeginBrowserLoginParams) => readonly ["/api/login", ...BeginBrowserLoginParams[]];
export declare const getBeginBrowserLoginQueryOptions: <TData = Awaited<ReturnType<typeof beginBrowserLogin>>, TError = ErrorType<void>>(params?: BeginBrowserLoginParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof beginBrowserLogin>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof beginBrowserLogin>>, TError, TData> & {
    queryKey: QueryKey;
};
export type BeginBrowserLoginQueryResult = NonNullable<Awaited<ReturnType<typeof beginBrowserLogin>>>;
export type BeginBrowserLoginQueryError = ErrorType<void>;
/**
 * @summary Start the browser OIDC login flow
 */
export declare function useBeginBrowserLogin<TData = Awaited<ReturnType<typeof beginBrowserLogin>>, TError = ErrorType<void>>(params?: BeginBrowserLoginParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof beginBrowserLogin>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getHandleBrowserLoginCallbackUrl: () => string;
/**
 * @summary Complete the browser OIDC login flow
 */
export declare const handleBrowserLoginCallback: (options?: RequestInit) => Promise<unknown>;
export declare const getHandleBrowserLoginCallbackQueryKey: () => readonly ["/api/callback"];
export declare const getHandleBrowserLoginCallbackQueryOptions: <TData = Awaited<ReturnType<typeof handleBrowserLoginCallback>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof handleBrowserLoginCallback>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof handleBrowserLoginCallback>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HandleBrowserLoginCallbackQueryResult = NonNullable<Awaited<ReturnType<typeof handleBrowserLoginCallback>>>;
export type HandleBrowserLoginCallbackQueryError = ErrorType<void>;
/**
 * @summary Complete the browser OIDC login flow
 */
export declare function useHandleBrowserLoginCallback<TData = Awaited<ReturnType<typeof handleBrowserLoginCallback>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof handleBrowserLoginCallback>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getLogoutBrowserSessionUrl: () => string;
/**
 * @summary Clear the session and begin OIDC logout
 */
export declare const logoutBrowserSession: (options?: RequestInit) => Promise<unknown>;
export declare const getLogoutBrowserSessionQueryKey: () => readonly ["/api/logout"];
export declare const getLogoutBrowserSessionQueryOptions: <TData = Awaited<ReturnType<typeof logoutBrowserSession>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof logoutBrowserSession>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof logoutBrowserSession>>, TError, TData> & {
    queryKey: QueryKey;
};
export type LogoutBrowserSessionQueryResult = NonNullable<Awaited<ReturnType<typeof logoutBrowserSession>>>;
export type LogoutBrowserSessionQueryError = ErrorType<void>;
/**
 * @summary Clear the session and begin OIDC logout
 */
export declare function useLogoutBrowserSession<TData = Awaited<ReturnType<typeof logoutBrowserSession>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof logoutBrowserSession>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getExchangeMobileAuthorizationCodeUrl: () => string;
/**
 * @summary Exchange a mobile OIDC code for a session token
 */
export declare const exchangeMobileAuthorizationCode: (mobileTokenExchangeRequest: MobileTokenExchangeRequest, options?: RequestInit) => Promise<MobileTokenExchangeSuccess>;
export declare const getExchangeMobileAuthorizationCodeMutationOptions: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof exchangeMobileAuthorizationCode>>, TError, {
        data: BodyType<MobileTokenExchangeRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof exchangeMobileAuthorizationCode>>, TError, {
    data: BodyType<MobileTokenExchangeRequest>;
}, TContext>;
export type ExchangeMobileAuthorizationCodeMutationResult = NonNullable<Awaited<ReturnType<typeof exchangeMobileAuthorizationCode>>>;
export type ExchangeMobileAuthorizationCodeMutationBody = BodyType<MobileTokenExchangeRequest>;
export type ExchangeMobileAuthorizationCodeMutationError = ErrorType<ErrorEnvelope>;
/**
* @summary Exchange a mobile OIDC code for a session token
*/
export declare const useExchangeMobileAuthorizationCode: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof exchangeMobileAuthorizationCode>>, TError, {
        data: BodyType<MobileTokenExchangeRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof exchangeMobileAuthorizationCode>>, TError, {
    data: BodyType<MobileTokenExchangeRequest>;
}, TContext>;
export declare const getLogoutMobileSessionUrl: () => string;
/**
 * @summary Delete a mobile session token
 */
export declare const logoutMobileSession: (options?: RequestInit) => Promise<LogoutSuccess>;
export declare const getLogoutMobileSessionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logoutMobileSession>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof logoutMobileSession>>, TError, void, TContext>;
export type LogoutMobileSessionMutationResult = NonNullable<Awaited<ReturnType<typeof logoutMobileSession>>>;
export type LogoutMobileSessionMutationError = ErrorType<unknown>;
/**
* @summary Delete a mobile session token
*/
export declare const useLogoutMobileSession: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logoutMobileSession>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof logoutMobileSession>>, TError, void, TContext>;
export declare const getRequestUploadUrlUrl: () => string;
/**
 * @summary Request a presigned URL for file upload
 */
export declare const requestUploadUrl: (uploadUrlRequest: UploadUrlRequest, options?: RequestInit) => Promise<UploadUrlResponse>;
export declare const getRequestUploadUrlMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
        data: BodyType<UploadUrlRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
    data: BodyType<UploadUrlRequest>;
}, TContext>;
export type RequestUploadUrlMutationResult = NonNullable<Awaited<ReturnType<typeof requestUploadUrl>>>;
export type RequestUploadUrlMutationBody = BodyType<UploadUrlRequest>;
export type RequestUploadUrlMutationError = ErrorType<unknown>;
/**
* @summary Request a presigned URL for file upload
*/
export declare const useRequestUploadUrl: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
        data: BodyType<UploadUrlRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
    data: BodyType<UploadUrlRequest>;
}, TContext>;
export declare const getGetStorageObjectUrl: (objectPath: string) => string;
/**
 * @summary Serve an uploaded file
 */
export declare const getStorageObject: (objectPath: string, options?: RequestInit) => Promise<Blob>;
export declare const getGetStorageObjectQueryKey: (objectPath: string) => readonly [`/api/storage/objects/${string}`];
export declare const getGetStorageObjectQueryOptions: <TData = Awaited<ReturnType<typeof getStorageObject>>, TError = ErrorType<unknown>>(objectPath: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetStorageObjectQueryResult = NonNullable<Awaited<ReturnType<typeof getStorageObject>>>;
export type GetStorageObjectQueryError = ErrorType<unknown>;
/**
 * @summary Serve an uploaded file
 */
export declare function useGetStorageObject<TData = Awaited<ReturnType<typeof getStorageObject>>, TError = ErrorType<unknown>>(objectPath: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getHealthCheckUrl: () => string;
/**
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListClientsUrl: () => string;
/**
 * @summary List all clients
 */
export declare const listClients: (options?: RequestInit) => Promise<Client[]>;
export declare const getListClientsQueryKey: () => readonly ["/api/clients"];
export declare const getListClientsQueryOptions: <TData = Awaited<ReturnType<typeof listClients>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listClients>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listClients>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListClientsQueryResult = NonNullable<Awaited<ReturnType<typeof listClients>>>;
export type ListClientsQueryError = ErrorType<unknown>;
/**
 * @summary List all clients
 */
export declare function useListClients<TData = Awaited<ReturnType<typeof listClients>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listClients>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateClientUrl: () => string;
/**
 * @summary Create a new client
 */
export declare const createClient: (clientInput: ClientInput, options?: RequestInit) => Promise<Client>;
export declare const getCreateClientMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createClient>>, TError, {
        data: BodyType<ClientInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createClient>>, TError, {
    data: BodyType<ClientInput>;
}, TContext>;
export type CreateClientMutationResult = NonNullable<Awaited<ReturnType<typeof createClient>>>;
export type CreateClientMutationBody = BodyType<ClientInput>;
export type CreateClientMutationError = ErrorType<unknown>;
/**
* @summary Create a new client
*/
export declare const useCreateClient: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createClient>>, TError, {
        data: BodyType<ClientInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createClient>>, TError, {
    data: BodyType<ClientInput>;
}, TContext>;
export declare const getGetClientUrl: (id: number) => string;
/**
 * @summary Get a client by ID
 */
export declare const getClient: (id: number, options?: RequestInit) => Promise<Client>;
export declare const getGetClientQueryKey: (id: number) => readonly [`/api/clients/${number}`];
export declare const getGetClientQueryOptions: <TData = Awaited<ReturnType<typeof getClient>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getClient>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getClient>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetClientQueryResult = NonNullable<Awaited<ReturnType<typeof getClient>>>;
export type GetClientQueryError = ErrorType<void>;
/**
 * @summary Get a client by ID
 */
export declare function useGetClient<TData = Awaited<ReturnType<typeof getClient>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getClient>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateClientUrl: (id: number) => string;
/**
 * @summary Update a client
 */
export declare const updateClient: (id: number, clientUpdate: ClientUpdate, options?: RequestInit) => Promise<Client>;
export declare const getUpdateClientMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateClient>>, TError, {
        id: number;
        data: BodyType<ClientUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateClient>>, TError, {
    id: number;
    data: BodyType<ClientUpdate>;
}, TContext>;
export type UpdateClientMutationResult = NonNullable<Awaited<ReturnType<typeof updateClient>>>;
export type UpdateClientMutationBody = BodyType<ClientUpdate>;
export type UpdateClientMutationError = ErrorType<unknown>;
/**
* @summary Update a client
*/
export declare const useUpdateClient: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateClient>>, TError, {
        id: number;
        data: BodyType<ClientUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateClient>>, TError, {
    id: number;
    data: BodyType<ClientUpdate>;
}, TContext>;
export declare const getDeleteClientUrl: (id: number) => string;
/**
 * @summary Delete a client
 */
export declare const deleteClient: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteClientMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteClient>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteClient>>, TError, {
    id: number;
}, TContext>;
export type DeleteClientMutationResult = NonNullable<Awaited<ReturnType<typeof deleteClient>>>;
export type DeleteClientMutationError = ErrorType<unknown>;
/**
* @summary Delete a client
*/
export declare const useDeleteClient: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteClient>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteClient>>, TError, {
    id: number;
}, TContext>;
export declare const getListScreensUrl: (params?: ListScreensParams) => string;
/**
 * @summary List all screens
 */
export declare const listScreens: (params?: ListScreensParams, options?: RequestInit) => Promise<Screen[]>;
export declare const getListScreensQueryKey: (params?: ListScreensParams) => readonly ["/api/screens", ...ListScreensParams[]];
export declare const getListScreensQueryOptions: <TData = Awaited<ReturnType<typeof listScreens>>, TError = ErrorType<unknown>>(params?: ListScreensParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listScreens>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listScreens>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListScreensQueryResult = NonNullable<Awaited<ReturnType<typeof listScreens>>>;
export type ListScreensQueryError = ErrorType<unknown>;
/**
 * @summary List all screens
 */
export declare function useListScreens<TData = Awaited<ReturnType<typeof listScreens>>, TError = ErrorType<unknown>>(params?: ListScreensParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listScreens>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateScreenUrl: () => string;
/**
 * @summary Register a new screen
 */
export declare const createScreen: (screenInput: ScreenInput, options?: RequestInit) => Promise<Screen>;
export declare const getCreateScreenMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createScreen>>, TError, {
        data: BodyType<ScreenInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createScreen>>, TError, {
    data: BodyType<ScreenInput>;
}, TContext>;
export type CreateScreenMutationResult = NonNullable<Awaited<ReturnType<typeof createScreen>>>;
export type CreateScreenMutationBody = BodyType<ScreenInput>;
export type CreateScreenMutationError = ErrorType<unknown>;
/**
* @summary Register a new screen
*/
export declare const useCreateScreen: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createScreen>>, TError, {
        data: BodyType<ScreenInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createScreen>>, TError, {
    data: BodyType<ScreenInput>;
}, TContext>;
export declare const getGetScreenUrl: (id: number) => string;
/**
 * @summary Get a screen by ID
 */
export declare const getScreen: (id: number, options?: RequestInit) => Promise<Screen>;
export declare const getGetScreenQueryKey: (id: number) => readonly [`/api/screens/${number}`];
export declare const getGetScreenQueryOptions: <TData = Awaited<ReturnType<typeof getScreen>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getScreen>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getScreen>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetScreenQueryResult = NonNullable<Awaited<ReturnType<typeof getScreen>>>;
export type GetScreenQueryError = ErrorType<unknown>;
/**
 * @summary Get a screen by ID
 */
export declare function useGetScreen<TData = Awaited<ReturnType<typeof getScreen>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getScreen>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateScreenUrl: (id: number) => string;
/**
 * @summary Update a screen
 */
export declare const updateScreen: (id: number, screenUpdate: ScreenUpdate, options?: RequestInit) => Promise<Screen>;
export declare const getUpdateScreenMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateScreen>>, TError, {
        id: number;
        data: BodyType<ScreenUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateScreen>>, TError, {
    id: number;
    data: BodyType<ScreenUpdate>;
}, TContext>;
export type UpdateScreenMutationResult = NonNullable<Awaited<ReturnType<typeof updateScreen>>>;
export type UpdateScreenMutationBody = BodyType<ScreenUpdate>;
export type UpdateScreenMutationError = ErrorType<unknown>;
/**
* @summary Update a screen
*/
export declare const useUpdateScreen: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateScreen>>, TError, {
        id: number;
        data: BodyType<ScreenUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateScreen>>, TError, {
    id: number;
    data: BodyType<ScreenUpdate>;
}, TContext>;
export declare const getDeleteScreenUrl: (id: number) => string;
/**
 * @summary Delete a screen
 */
export declare const deleteScreen: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteScreenMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteScreen>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteScreen>>, TError, {
    id: number;
}, TContext>;
export type DeleteScreenMutationResult = NonNullable<Awaited<ReturnType<typeof deleteScreen>>>;
export type DeleteScreenMutationError = ErrorType<unknown>;
/**
* @summary Delete a screen
*/
export declare const useDeleteScreen: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteScreen>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteScreen>>, TError, {
    id: number;
}, TContext>;
export declare const getPairScreenUrl: () => string;
/**
 * @summary Register a new screen via user pairing code (called from TVBox)
 */
export declare const pairScreen: (pairScreenInput: PairScreenInput, options?: RequestInit) => Promise<PairScreenResult>;
export declare const getPairScreenMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof pairScreen>>, TError, {
        data: BodyType<PairScreenInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof pairScreen>>, TError, {
    data: BodyType<PairScreenInput>;
}, TContext>;
export type PairScreenMutationResult = NonNullable<Awaited<ReturnType<typeof pairScreen>>>;
export type PairScreenMutationBody = BodyType<PairScreenInput>;
export type PairScreenMutationError = ErrorType<void>;
/**
* @summary Register a new screen via user pairing code (called from TVBox)
*/
export declare const usePairScreen: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof pairScreen>>, TError, {
        data: BodyType<PairScreenInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof pairScreen>>, TError, {
    data: BodyType<PairScreenInput>;
}, TContext>;
export declare const getListMediaUrl: (params?: ListMediaParams) => string;
/**
 * @summary List all media files
 */
export declare const listMedia: (params?: ListMediaParams, options?: RequestInit) => Promise<MediaFile[]>;
export declare const getListMediaQueryKey: (params?: ListMediaParams) => readonly ["/api/media", ...ListMediaParams[]];
export declare const getListMediaQueryOptions: <TData = Awaited<ReturnType<typeof listMedia>>, TError = ErrorType<unknown>>(params?: ListMediaParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMedia>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMedia>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMediaQueryResult = NonNullable<Awaited<ReturnType<typeof listMedia>>>;
export type ListMediaQueryError = ErrorType<unknown>;
/**
 * @summary List all media files
 */
export declare function useListMedia<TData = Awaited<ReturnType<typeof listMedia>>, TError = ErrorType<unknown>>(params?: ListMediaParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMedia>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateMediaUrl: () => string;
/**
 * @summary Add a media file (URL-based)
 */
export declare const createMedia: (mediaInput: MediaInput, options?: RequestInit) => Promise<MediaFile>;
export declare const getCreateMediaMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMedia>>, TError, {
        data: BodyType<MediaInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createMedia>>, TError, {
    data: BodyType<MediaInput>;
}, TContext>;
export type CreateMediaMutationResult = NonNullable<Awaited<ReturnType<typeof createMedia>>>;
export type CreateMediaMutationBody = BodyType<MediaInput>;
export type CreateMediaMutationError = ErrorType<unknown>;
/**
* @summary Add a media file (URL-based)
*/
export declare const useCreateMedia: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMedia>>, TError, {
        data: BodyType<MediaInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createMedia>>, TError, {
    data: BodyType<MediaInput>;
}, TContext>;
export declare const getGetMediaUrl: (id: number) => string;
/**
 * @summary Get a media file by ID
 */
export declare const getMedia: (id: number, options?: RequestInit) => Promise<MediaFile>;
export declare const getGetMediaQueryKey: (id: number) => readonly [`/api/media/${number}`];
export declare const getGetMediaQueryOptions: <TData = Awaited<ReturnType<typeof getMedia>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMedia>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMedia>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMediaQueryResult = NonNullable<Awaited<ReturnType<typeof getMedia>>>;
export type GetMediaQueryError = ErrorType<unknown>;
/**
 * @summary Get a media file by ID
 */
export declare function useGetMedia<TData = Awaited<ReturnType<typeof getMedia>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMedia>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateMediaUrl: (id: number) => string;
/**
 * @summary Rename / update a media file
 */
export declare const updateMedia: (id: number, updateMediaBody: UpdateMediaBody, options?: RequestInit) => Promise<MediaFile>;
export declare const getUpdateMediaMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMedia>>, TError, {
        id: number;
        data: BodyType<UpdateMediaBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateMedia>>, TError, {
    id: number;
    data: BodyType<UpdateMediaBody>;
}, TContext>;
export type UpdateMediaMutationResult = NonNullable<Awaited<ReturnType<typeof updateMedia>>>;
export type UpdateMediaMutationBody = BodyType<UpdateMediaBody>;
export type UpdateMediaMutationError = ErrorType<unknown>;
/**
* @summary Rename / update a media file
*/
export declare const useUpdateMedia: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMedia>>, TError, {
        id: number;
        data: BodyType<UpdateMediaBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateMedia>>, TError, {
    id: number;
    data: BodyType<UpdateMediaBody>;
}, TContext>;
export declare const getDeleteMediaUrl: (id: number) => string;
/**
 * @summary Delete a media file
 */
export declare const deleteMedia: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteMediaMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteMedia>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteMedia>>, TError, {
    id: number;
}, TContext>;
export type DeleteMediaMutationResult = NonNullable<Awaited<ReturnType<typeof deleteMedia>>>;
export type DeleteMediaMutationError = ErrorType<unknown>;
/**
* @summary Delete a media file
*/
export declare const useDeleteMedia: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteMedia>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteMedia>>, TError, {
    id: number;
}, TContext>;
export declare const getListPlaylistsUrl: (params?: ListPlaylistsParams) => string;
/**
 * @summary List all playlists
 */
export declare const listPlaylists: (params?: ListPlaylistsParams, options?: RequestInit) => Promise<Playlist[]>;
export declare const getListPlaylistsQueryKey: (params?: ListPlaylistsParams) => readonly ["/api/playlists", ...ListPlaylistsParams[]];
export declare const getListPlaylistsQueryOptions: <TData = Awaited<ReturnType<typeof listPlaylists>>, TError = ErrorType<unknown>>(params?: ListPlaylistsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPlaylists>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPlaylists>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPlaylistsQueryResult = NonNullable<Awaited<ReturnType<typeof listPlaylists>>>;
export type ListPlaylistsQueryError = ErrorType<unknown>;
/**
 * @summary List all playlists
 */
export declare function useListPlaylists<TData = Awaited<ReturnType<typeof listPlaylists>>, TError = ErrorType<unknown>>(params?: ListPlaylistsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPlaylists>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreatePlaylistUrl: () => string;
/**
 * @summary Create a new playlist
 */
export declare const createPlaylist: (playlistInput: PlaylistInput, options?: RequestInit) => Promise<Playlist>;
export declare const getCreatePlaylistMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPlaylist>>, TError, {
        data: BodyType<PlaylistInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPlaylist>>, TError, {
    data: BodyType<PlaylistInput>;
}, TContext>;
export type CreatePlaylistMutationResult = NonNullable<Awaited<ReturnType<typeof createPlaylist>>>;
export type CreatePlaylistMutationBody = BodyType<PlaylistInput>;
export type CreatePlaylistMutationError = ErrorType<unknown>;
/**
* @summary Create a new playlist
*/
export declare const useCreatePlaylist: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPlaylist>>, TError, {
        data: BodyType<PlaylistInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPlaylist>>, TError, {
    data: BodyType<PlaylistInput>;
}, TContext>;
export declare const getGetPlaylistUrl: (id: number) => string;
/**
 * @summary Get a playlist with its items
 */
export declare const getPlaylist: (id: number, options?: RequestInit) => Promise<PlaylistDetail>;
export declare const getGetPlaylistQueryKey: (id: number) => readonly [`/api/playlists/${number}`];
export declare const getGetPlaylistQueryOptions: <TData = Awaited<ReturnType<typeof getPlaylist>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlaylist>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPlaylist>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPlaylistQueryResult = NonNullable<Awaited<ReturnType<typeof getPlaylist>>>;
export type GetPlaylistQueryError = ErrorType<unknown>;
/**
 * @summary Get a playlist with its items
 */
export declare function useGetPlaylist<TData = Awaited<ReturnType<typeof getPlaylist>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlaylist>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdatePlaylistUrl: (id: number) => string;
/**
 * @summary Update a playlist
 */
export declare const updatePlaylist: (id: number, playlistUpdate: PlaylistUpdate, options?: RequestInit) => Promise<Playlist>;
export declare const getUpdatePlaylistMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePlaylist>>, TError, {
        id: number;
        data: BodyType<PlaylistUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePlaylist>>, TError, {
    id: number;
    data: BodyType<PlaylistUpdate>;
}, TContext>;
export type UpdatePlaylistMutationResult = NonNullable<Awaited<ReturnType<typeof updatePlaylist>>>;
export type UpdatePlaylistMutationBody = BodyType<PlaylistUpdate>;
export type UpdatePlaylistMutationError = ErrorType<unknown>;
/**
* @summary Update a playlist
*/
export declare const useUpdatePlaylist: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePlaylist>>, TError, {
        id: number;
        data: BodyType<PlaylistUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePlaylist>>, TError, {
    id: number;
    data: BodyType<PlaylistUpdate>;
}, TContext>;
export declare const getDeletePlaylistUrl: (id: number) => string;
/**
 * @summary Delete a playlist
 */
export declare const deletePlaylist: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeletePlaylistMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePlaylist>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePlaylist>>, TError, {
    id: number;
}, TContext>;
export type DeletePlaylistMutationResult = NonNullable<Awaited<ReturnType<typeof deletePlaylist>>>;
export type DeletePlaylistMutationError = ErrorType<unknown>;
/**
* @summary Delete a playlist
*/
export declare const useDeletePlaylist: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePlaylist>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePlaylist>>, TError, {
    id: number;
}, TContext>;
export declare const getPublishPlaylistUrl: (id: number) => string;
/**
 * Copies the current draft (playlist_items + layoutJson + transitionEffect) into a published snapshot. Screens only receive the published snapshot after this call (playlists never published yet still fall back to live draft).
 * @summary Publish draft playlist content to screens
 */
export declare const publishPlaylist: (id: number, options?: RequestInit) => Promise<PublishPlaylist200>;
export declare const getPublishPlaylistMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishPlaylist>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof publishPlaylist>>, TError, {
    id: number;
}, TContext>;
export type PublishPlaylistMutationResult = NonNullable<Awaited<ReturnType<typeof publishPlaylist>>>;
export type PublishPlaylistMutationError = ErrorType<void>;
/**
* @summary Publish draft playlist content to screens
*/
export declare const usePublishPlaylist: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishPlaylist>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof publishPlaylist>>, TError, {
    id: number;
}, TContext>;
export declare const getAddPlaylistItemUrl: (id: number) => string;
/**
 * @summary Add a media item to a playlist
 */
export declare const addPlaylistItem: (id: number, playlistItemInput: PlaylistItemInput, options?: RequestInit) => Promise<PlaylistItem>;
export declare const getAddPlaylistItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addPlaylistItem>>, TError, {
        id: number;
        data: BodyType<PlaylistItemInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addPlaylistItem>>, TError, {
    id: number;
    data: BodyType<PlaylistItemInput>;
}, TContext>;
export type AddPlaylistItemMutationResult = NonNullable<Awaited<ReturnType<typeof addPlaylistItem>>>;
export type AddPlaylistItemMutationBody = BodyType<PlaylistItemInput>;
export type AddPlaylistItemMutationError = ErrorType<unknown>;
/**
* @summary Add a media item to a playlist
*/
export declare const useAddPlaylistItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addPlaylistItem>>, TError, {
        id: number;
        data: BodyType<PlaylistItemInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addPlaylistItem>>, TError, {
    id: number;
    data: BodyType<PlaylistItemInput>;
}, TContext>;
export declare const getReorderPlaylistItemsUrl: (id: number) => string;
/**
 * @summary Reorder playlist items
 */
export declare const reorderPlaylistItems: (id: number, reorderPlaylistItemsBody: ReorderPlaylistItemsBody, options?: RequestInit) => Promise<ReorderPlaylistItems200>;
export declare const getReorderPlaylistItemsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reorderPlaylistItems>>, TError, {
        id: number;
        data: BodyType<ReorderPlaylistItemsBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof reorderPlaylistItems>>, TError, {
    id: number;
    data: BodyType<ReorderPlaylistItemsBody>;
}, TContext>;
export type ReorderPlaylistItemsMutationResult = NonNullable<Awaited<ReturnType<typeof reorderPlaylistItems>>>;
export type ReorderPlaylistItemsMutationBody = BodyType<ReorderPlaylistItemsBody>;
export type ReorderPlaylistItemsMutationError = ErrorType<unknown>;
/**
* @summary Reorder playlist items
*/
export declare const useReorderPlaylistItems: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reorderPlaylistItems>>, TError, {
        id: number;
        data: BodyType<ReorderPlaylistItemsBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof reorderPlaylistItems>>, TError, {
    id: number;
    data: BodyType<ReorderPlaylistItemsBody>;
}, TContext>;
export declare const getUpdatePlaylistItemUrl: (id: number, itemId: number) => string;
/**
 * @summary Update a playlist item (duration, position)
 */
export declare const updatePlaylistItem: (id: number, itemId: number, updatePlaylistItemBody: UpdatePlaylistItemBody, options?: RequestInit) => Promise<PlaylistItem>;
export declare const getUpdatePlaylistItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePlaylistItem>>, TError, {
        id: number;
        itemId: number;
        data: BodyType<UpdatePlaylistItemBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePlaylistItem>>, TError, {
    id: number;
    itemId: number;
    data: BodyType<UpdatePlaylistItemBody>;
}, TContext>;
export type UpdatePlaylistItemMutationResult = NonNullable<Awaited<ReturnType<typeof updatePlaylistItem>>>;
export type UpdatePlaylistItemMutationBody = BodyType<UpdatePlaylistItemBody>;
export type UpdatePlaylistItemMutationError = ErrorType<unknown>;
/**
* @summary Update a playlist item (duration, position)
*/
export declare const useUpdatePlaylistItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePlaylistItem>>, TError, {
        id: number;
        itemId: number;
        data: BodyType<UpdatePlaylistItemBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePlaylistItem>>, TError, {
    id: number;
    itemId: number;
    data: BodyType<UpdatePlaylistItemBody>;
}, TContext>;
export declare const getRemovePlaylistItemUrl: (id: number, itemId: number) => string;
/**
 * @summary Remove a media item from a playlist
 */
export declare const removePlaylistItem: (id: number, itemId: number, options?: RequestInit) => Promise<void>;
export declare const getRemovePlaylistItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removePlaylistItem>>, TError, {
        id: number;
        itemId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removePlaylistItem>>, TError, {
    id: number;
    itemId: number;
}, TContext>;
export type RemovePlaylistItemMutationResult = NonNullable<Awaited<ReturnType<typeof removePlaylistItem>>>;
export type RemovePlaylistItemMutationError = ErrorType<unknown>;
/**
* @summary Remove a media item from a playlist
*/
export declare const useRemovePlaylistItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removePlaylistItem>>, TError, {
        id: number;
        itemId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removePlaylistItem>>, TError, {
    id: number;
    itemId: number;
}, TContext>;
export declare const getListSchedulesUrl: (params?: ListSchedulesParams) => string;
/**
 * @summary List all schedules
 */
export declare const listSchedules: (params?: ListSchedulesParams, options?: RequestInit) => Promise<Schedule[]>;
export declare const getListSchedulesQueryKey: (params?: ListSchedulesParams) => readonly ["/api/schedules", ...ListSchedulesParams[]];
export declare const getListSchedulesQueryOptions: <TData = Awaited<ReturnType<typeof listSchedules>>, TError = ErrorType<unknown>>(params?: ListSchedulesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listSchedules>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listSchedules>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListSchedulesQueryResult = NonNullable<Awaited<ReturnType<typeof listSchedules>>>;
export type ListSchedulesQueryError = ErrorType<unknown>;
/**
 * @summary List all schedules
 */
export declare function useListSchedules<TData = Awaited<ReturnType<typeof listSchedules>>, TError = ErrorType<unknown>>(params?: ListSchedulesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listSchedules>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateScheduleUrl: () => string;
/**
 * @summary Create a new schedule
 */
export declare const createSchedule: (scheduleInput: ScheduleInput, options?: RequestInit) => Promise<Schedule>;
export declare const getCreateScheduleMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createSchedule>>, TError, {
        data: BodyType<ScheduleInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createSchedule>>, TError, {
    data: BodyType<ScheduleInput>;
}, TContext>;
export type CreateScheduleMutationResult = NonNullable<Awaited<ReturnType<typeof createSchedule>>>;
export type CreateScheduleMutationBody = BodyType<ScheduleInput>;
export type CreateScheduleMutationError = ErrorType<unknown>;
/**
* @summary Create a new schedule
*/
export declare const useCreateSchedule: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createSchedule>>, TError, {
        data: BodyType<ScheduleInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createSchedule>>, TError, {
    data: BodyType<ScheduleInput>;
}, TContext>;
export declare const getUpdateScheduleUrl: (id: number) => string;
/**
 * @summary Update a schedule
 */
export declare const updateSchedule: (id: number, scheduleUpdate: ScheduleUpdate, options?: RequestInit) => Promise<Schedule>;
export declare const getUpdateScheduleMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSchedule>>, TError, {
        id: number;
        data: BodyType<ScheduleUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateSchedule>>, TError, {
    id: number;
    data: BodyType<ScheduleUpdate>;
}, TContext>;
export type UpdateScheduleMutationResult = NonNullable<Awaited<ReturnType<typeof updateSchedule>>>;
export type UpdateScheduleMutationBody = BodyType<ScheduleUpdate>;
export type UpdateScheduleMutationError = ErrorType<unknown>;
/**
* @summary Update a schedule
*/
export declare const useUpdateSchedule: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSchedule>>, TError, {
        id: number;
        data: BodyType<ScheduleUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateSchedule>>, TError, {
    id: number;
    data: BodyType<ScheduleUpdate>;
}, TContext>;
export declare const getDeleteScheduleUrl: (id: number) => string;
/**
 * @summary Delete a schedule
 */
export declare const deleteSchedule: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteScheduleMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteSchedule>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteSchedule>>, TError, {
    id: number;
}, TContext>;
export type DeleteScheduleMutationResult = NonNullable<Awaited<ReturnType<typeof deleteSchedule>>>;
export type DeleteScheduleMutationError = ErrorType<unknown>;
/**
* @summary Delete a schedule
*/
export declare const useDeleteSchedule: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteSchedule>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteSchedule>>, TError, {
    id: number;
}, TContext>;
export declare const getBroadcastPlaylistUrl: () => string;
/**
 * @summary Send a playlist to ALL screens of the authenticated user
 */
export declare const broadcastPlaylist: (broadcastInput: BroadcastInput, options?: RequestInit) => Promise<BroadcastResult>;
export declare const getBroadcastPlaylistMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof broadcastPlaylist>>, TError, {
        data: BodyType<BroadcastInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof broadcastPlaylist>>, TError, {
    data: BodyType<BroadcastInput>;
}, TContext>;
export type BroadcastPlaylistMutationResult = NonNullable<Awaited<ReturnType<typeof broadcastPlaylist>>>;
export type BroadcastPlaylistMutationBody = BodyType<BroadcastInput>;
export type BroadcastPlaylistMutationError = ErrorType<void>;
/**
* @summary Send a playlist to ALL screens of the authenticated user
*/
export declare const useBroadcastPlaylist: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof broadcastPlaylist>>, TError, {
        data: BodyType<BroadcastInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof broadcastPlaylist>>, TError, {
    data: BodyType<BroadcastInput>;
}, TContext>;
export declare const getListPlayHistoryUrl: (params?: ListPlayHistoryParams) => string;
/**
 * @summary Get play history log
 */
export declare const listPlayHistory: (params?: ListPlayHistoryParams, options?: RequestInit) => Promise<ListPlayHistory200>;
export declare const getListPlayHistoryQueryKey: (params?: ListPlayHistoryParams) => readonly ["/api/reports/plays", ...ListPlayHistoryParams[]];
export declare const getListPlayHistoryQueryOptions: <TData = Awaited<ReturnType<typeof listPlayHistory>>, TError = ErrorType<unknown>>(params?: ListPlayHistoryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPlayHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPlayHistory>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPlayHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof listPlayHistory>>>;
export type ListPlayHistoryQueryError = ErrorType<unknown>;
/**
 * @summary Get play history log
 */
export declare function useListPlayHistory<TData = Awaited<ReturnType<typeof listPlayHistory>>, TError = ErrorType<unknown>>(params?: ListPlayHistoryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPlayHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetReportPeriodSummaryUrl: (params?: GetReportPeriodSummaryParams) => string;
/**
 * @summary Get per-media play counts for a date period
 */
export declare const getReportPeriodSummary: (params?: GetReportPeriodSummaryParams, options?: RequestInit) => Promise<GetReportPeriodSummary200>;
export declare const getGetReportPeriodSummaryQueryKey: (params?: GetReportPeriodSummaryParams) => readonly ["/api/reports/period-summary", ...GetReportPeriodSummaryParams[]];
export declare const getGetReportPeriodSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getReportPeriodSummary>>, TError = ErrorType<unknown>>(params?: GetReportPeriodSummaryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getReportPeriodSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getReportPeriodSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetReportPeriodSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getReportPeriodSummary>>>;
export type GetReportPeriodSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get per-media play counts for a date period
 */
export declare function useGetReportPeriodSummary<TData = Awaited<ReturnType<typeof getReportPeriodSummary>>, TError = ErrorType<unknown>>(params?: GetReportPeriodSummaryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getReportPeriodSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetReportSummaryUrl: () => string;
/**
 * @summary Get aggregated play statistics
 */
export declare const getReportSummary: (options?: RequestInit) => Promise<ReportSummary>;
export declare const getGetReportSummaryQueryKey: () => readonly ["/api/reports/summary"];
export declare const getGetReportSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getReportSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getReportSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getReportSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetReportSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getReportSummary>>>;
export type GetReportSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get aggregated play statistics
 */
export declare function useGetReportSummary<TData = Awaited<ReturnType<typeof getReportSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getReportSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDashboardStatsUrl: () => string;
/**
 * @summary Get overall dashboard statistics
 */
export declare const getDashboardStats: (options?: RequestInit) => Promise<DashboardStats>;
export declare const getGetDashboardStatsQueryKey: () => readonly ["/api/dashboard/stats"];
export declare const getGetDashboardStatsQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardStats>>>;
export type GetDashboardStatsQueryError = ErrorType<unknown>;
/**
 * @summary Get overall dashboard statistics
 */
export declare function useGetDashboardStats<TData = Awaited<ReturnType<typeof getDashboardStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDashboardActivityUrl: () => string;
/**
 * @summary Get recent activity feed
 */
export declare const getDashboardActivity: (options?: RequestInit) => Promise<ActivityItem[]>;
export declare const getGetDashboardActivityQueryKey: () => readonly ["/api/dashboard/activity"];
export declare const getGetDashboardActivityQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardActivity>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardActivity>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardActivityQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardActivity>>>;
export type GetDashboardActivityQueryError = ErrorType<unknown>;
/**
 * @summary Get recent activity feed
 */
export declare function useGetDashboardActivity<TData = Awaited<ReturnType<typeof getDashboardActivity>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPlayerPlaylistUrl: (screenCode: string) => string;
/**
 * @summary Get current playlist for a screen (used by TV player)
 */
export declare const getPlayerPlaylist: (screenCode: string, options?: RequestInit) => Promise<PlayerPayload>;
export declare const getGetPlayerPlaylistQueryKey: (screenCode: string) => readonly [`/api/player/${string}`];
export declare const getGetPlayerPlaylistQueryOptions: <TData = Awaited<ReturnType<typeof getPlayerPlaylist>>, TError = ErrorType<void>>(screenCode: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlayerPlaylist>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPlayerPlaylist>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPlayerPlaylistQueryResult = NonNullable<Awaited<ReturnType<typeof getPlayerPlaylist>>>;
export type GetPlayerPlaylistQueryError = ErrorType<void>;
/**
 * @summary Get current playlist for a screen (used by TV player)
 */
export declare function useGetPlayerPlaylist<TData = Awaited<ReturnType<typeof getPlayerPlaylist>>, TError = ErrorType<void>>(screenCode: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlayerPlaylist>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListScreenGroupsUrl: () => string;
/**
 * @summary List all screen groups
 */
export declare const listScreenGroups: (options?: RequestInit) => Promise<ScreenGroup[]>;
export declare const getListScreenGroupsQueryKey: () => readonly ["/api/screen-groups"];
export declare const getListScreenGroupsQueryOptions: <TData = Awaited<ReturnType<typeof listScreenGroups>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listScreenGroups>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listScreenGroups>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListScreenGroupsQueryResult = NonNullable<Awaited<ReturnType<typeof listScreenGroups>>>;
export type ListScreenGroupsQueryError = ErrorType<unknown>;
/**
 * @summary List all screen groups
 */
export declare function useListScreenGroups<TData = Awaited<ReturnType<typeof listScreenGroups>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listScreenGroups>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateScreenGroupUrl: () => string;
/**
 * @summary Create a screen group
 */
export declare const createScreenGroup: (createScreenGroupBody: CreateScreenGroupBody, options?: RequestInit) => Promise<ScreenGroup>;
export declare const getCreateScreenGroupMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createScreenGroup>>, TError, {
        data: BodyType<CreateScreenGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createScreenGroup>>, TError, {
    data: BodyType<CreateScreenGroupBody>;
}, TContext>;
export type CreateScreenGroupMutationResult = NonNullable<Awaited<ReturnType<typeof createScreenGroup>>>;
export type CreateScreenGroupMutationBody = BodyType<CreateScreenGroupBody>;
export type CreateScreenGroupMutationError = ErrorType<unknown>;
/**
* @summary Create a screen group
*/
export declare const useCreateScreenGroup: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createScreenGroup>>, TError, {
        data: BodyType<CreateScreenGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createScreenGroup>>, TError, {
    data: BodyType<CreateScreenGroupBody>;
}, TContext>;
export declare const getUpdateScreenGroupUrl: (id: number) => string;
/**
 * @summary Update a screen group
 */
export declare const updateScreenGroup: (id: number, updateScreenGroupBody: UpdateScreenGroupBody, options?: RequestInit) => Promise<ScreenGroup>;
export declare const getUpdateScreenGroupMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateScreenGroup>>, TError, {
        id: number;
        data: BodyType<UpdateScreenGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateScreenGroup>>, TError, {
    id: number;
    data: BodyType<UpdateScreenGroupBody>;
}, TContext>;
export type UpdateScreenGroupMutationResult = NonNullable<Awaited<ReturnType<typeof updateScreenGroup>>>;
export type UpdateScreenGroupMutationBody = BodyType<UpdateScreenGroupBody>;
export type UpdateScreenGroupMutationError = ErrorType<unknown>;
/**
* @summary Update a screen group
*/
export declare const useUpdateScreenGroup: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateScreenGroup>>, TError, {
        id: number;
        data: BodyType<UpdateScreenGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateScreenGroup>>, TError, {
    id: number;
    data: BodyType<UpdateScreenGroupBody>;
}, TContext>;
export declare const getDeleteScreenGroupUrl: (id: number) => string;
/**
 * @summary Delete a screen group
 */
export declare const deleteScreenGroup: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteScreenGroupMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteScreenGroup>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteScreenGroup>>, TError, {
    id: number;
}, TContext>;
export type DeleteScreenGroupMutationResult = NonNullable<Awaited<ReturnType<typeof deleteScreenGroup>>>;
export type DeleteScreenGroupMutationError = ErrorType<unknown>;
/**
* @summary Delete a screen group
*/
export declare const useDeleteScreenGroup: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteScreenGroup>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteScreenGroup>>, TError, {
    id: number;
}, TContext>;
export declare const getAssignScreenToGroupUrl: (id: number) => string;
/**
 * @summary Assign a screen to a group
 */
export declare const assignScreenToGroup: (id: number, assignScreenToGroupBody: AssignScreenToGroupBody, options?: RequestInit) => Promise<void>;
export declare const getAssignScreenToGroupMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assignScreenToGroup>>, TError, {
        id: number;
        data: BodyType<AssignScreenToGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof assignScreenToGroup>>, TError, {
    id: number;
    data: BodyType<AssignScreenToGroupBody>;
}, TContext>;
export type AssignScreenToGroupMutationResult = NonNullable<Awaited<ReturnType<typeof assignScreenToGroup>>>;
export type AssignScreenToGroupMutationBody = BodyType<AssignScreenToGroupBody>;
export type AssignScreenToGroupMutationError = ErrorType<unknown>;
/**
* @summary Assign a screen to a group
*/
export declare const useAssignScreenToGroup: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assignScreenToGroup>>, TError, {
        id: number;
        data: BodyType<AssignScreenToGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof assignScreenToGroup>>, TError, {
    id: number;
    data: BodyType<AssignScreenToGroupBody>;
}, TContext>;
export declare const getUnassignScreenFromGroupUrl: (id: number) => string;
/**
 * @summary Remove a screen from its group
 */
export declare const unassignScreenFromGroup: (id: number, unassignScreenFromGroupBody: UnassignScreenFromGroupBody, options?: RequestInit) => Promise<void>;
export declare const getUnassignScreenFromGroupMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof unassignScreenFromGroup>>, TError, {
        id: number;
        data: BodyType<UnassignScreenFromGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof unassignScreenFromGroup>>, TError, {
    id: number;
    data: BodyType<UnassignScreenFromGroupBody>;
}, TContext>;
export type UnassignScreenFromGroupMutationResult = NonNullable<Awaited<ReturnType<typeof unassignScreenFromGroup>>>;
export type UnassignScreenFromGroupMutationBody = BodyType<UnassignScreenFromGroupBody>;
export type UnassignScreenFromGroupMutationError = ErrorType<unknown>;
/**
* @summary Remove a screen from its group
*/
export declare const useUnassignScreenFromGroup: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof unassignScreenFromGroup>>, TError, {
        id: number;
        data: BodyType<UnassignScreenFromGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof unassignScreenFromGroup>>, TError, {
    id: number;
    data: BodyType<UnassignScreenFromGroupBody>;
}, TContext>;
export declare const getPushPlaylistToGroupUrl: (id: number) => string;
/**
 * @summary Push a playlist to all screens in a group
 */
export declare const pushPlaylistToGroup: (id: number, pushPlaylistToGroupBody: PushPlaylistToGroupBody, options?: RequestInit) => Promise<PushPlaylistToGroup200>;
export declare const getPushPlaylistToGroupMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof pushPlaylistToGroup>>, TError, {
        id: number;
        data: BodyType<PushPlaylistToGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof pushPlaylistToGroup>>, TError, {
    id: number;
    data: BodyType<PushPlaylistToGroupBody>;
}, TContext>;
export type PushPlaylistToGroupMutationResult = NonNullable<Awaited<ReturnType<typeof pushPlaylistToGroup>>>;
export type PushPlaylistToGroupMutationBody = BodyType<PushPlaylistToGroupBody>;
export type PushPlaylistToGroupMutationError = ErrorType<unknown>;
/**
* @summary Push a playlist to all screens in a group
*/
export declare const usePushPlaylistToGroup: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof pushPlaylistToGroup>>, TError, {
        id: number;
        data: BodyType<PushPlaylistToGroupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof pushPlaylistToGroup>>, TError, {
    id: number;
    data: BodyType<PushPlaylistToGroupBody>;
}, TContext>;
export declare const getListEmergencyAlertsUrl: () => string;
/**
 * @summary List emergency alerts
 */
export declare const listEmergencyAlerts: (options?: RequestInit) => Promise<EmergencyAlert[]>;
export declare const getListEmergencyAlertsQueryKey: () => readonly ["/api/emergency"];
export declare const getListEmergencyAlertsQueryOptions: <TData = Awaited<ReturnType<typeof listEmergencyAlerts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listEmergencyAlerts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listEmergencyAlerts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListEmergencyAlertsQueryResult = NonNullable<Awaited<ReturnType<typeof listEmergencyAlerts>>>;
export type ListEmergencyAlertsQueryError = ErrorType<unknown>;
/**
 * @summary List emergency alerts
 */
export declare function useListEmergencyAlerts<TData = Awaited<ReturnType<typeof listEmergencyAlerts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listEmergencyAlerts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateEmergencyAlertUrl: () => string;
/**
 * @summary Create and activate an emergency alert
 */
export declare const createEmergencyAlert: (createEmergencyAlertBody: CreateEmergencyAlertBody, options?: RequestInit) => Promise<EmergencyAlert>;
export declare const getCreateEmergencyAlertMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createEmergencyAlert>>, TError, {
        data: BodyType<CreateEmergencyAlertBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createEmergencyAlert>>, TError, {
    data: BodyType<CreateEmergencyAlertBody>;
}, TContext>;
export type CreateEmergencyAlertMutationResult = NonNullable<Awaited<ReturnType<typeof createEmergencyAlert>>>;
export type CreateEmergencyAlertMutationBody = BodyType<CreateEmergencyAlertBody>;
export type CreateEmergencyAlertMutationError = ErrorType<unknown>;
/**
* @summary Create and activate an emergency alert
*/
export declare const useCreateEmergencyAlert: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createEmergencyAlert>>, TError, {
        data: BodyType<CreateEmergencyAlertBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createEmergencyAlert>>, TError, {
    data: BodyType<CreateEmergencyAlertBody>;
}, TContext>;
export declare const getGetActiveEmergencyAlertUrl: () => string;
/**
 * @summary Get the currently active emergency alert
 */
export declare const getActiveEmergencyAlert: (options?: RequestInit) => Promise<EmergencyAlert>;
export declare const getGetActiveEmergencyAlertQueryKey: () => readonly ["/api/emergency/active"];
export declare const getGetActiveEmergencyAlertQueryOptions: <TData = Awaited<ReturnType<typeof getActiveEmergencyAlert>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getActiveEmergencyAlert>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getActiveEmergencyAlert>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetActiveEmergencyAlertQueryResult = NonNullable<Awaited<ReturnType<typeof getActiveEmergencyAlert>>>;
export type GetActiveEmergencyAlertQueryError = ErrorType<unknown>;
/**
 * @summary Get the currently active emergency alert
 */
export declare function useGetActiveEmergencyAlert<TData = Awaited<ReturnType<typeof getActiveEmergencyAlert>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getActiveEmergencyAlert>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCancelEmergencyAlertUrl: (id: number) => string;
/**
 * @summary Cancel an emergency alert
 */
export declare const cancelEmergencyAlert: (id: number, options?: RequestInit) => Promise<void>;
export declare const getCancelEmergencyAlertMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof cancelEmergencyAlert>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof cancelEmergencyAlert>>, TError, {
    id: number;
}, TContext>;
export type CancelEmergencyAlertMutationResult = NonNullable<Awaited<ReturnType<typeof cancelEmergencyAlert>>>;
export type CancelEmergencyAlertMutationError = ErrorType<unknown>;
/**
* @summary Cancel an emergency alert
*/
export declare const useCancelEmergencyAlert: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof cancelEmergencyAlert>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof cancelEmergencyAlert>>, TError, {
    id: number;
}, TContext>;
export declare const getLogMediaPlayUrl: (screenCode: string) => string;
/**
 * @summary Log a media play event (called by TV player when a media finishes)
 */
export declare const logMediaPlay: (screenCode: string, playEvent: PlayEvent, options?: RequestInit) => Promise<void>;
export declare const getLogMediaPlayMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logMediaPlay>>, TError, {
        screenCode: string;
        data: BodyType<PlayEvent>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof logMediaPlay>>, TError, {
    screenCode: string;
    data: BodyType<PlayEvent>;
}, TContext>;
export type LogMediaPlayMutationResult = NonNullable<Awaited<ReturnType<typeof logMediaPlay>>>;
export type LogMediaPlayMutationBody = BodyType<PlayEvent>;
export type LogMediaPlayMutationError = ErrorType<unknown>;
/**
* @summary Log a media play event (called by TV player when a media finishes)
*/
export declare const useLogMediaPlay: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logMediaPlay>>, TError, {
        screenCode: string;
        data: BodyType<PlayEvent>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof logMediaPlay>>, TError, {
    screenCode: string;
    data: BodyType<PlayEvent>;
}, TContext>;
export declare const getHeartbeatUrl: (screenCode: string) => string;
/**
 * @summary Update screen last-seen timestamp (called by TV player every minute)
 */
export declare const heartbeat: (screenCode: string, options?: RequestInit) => Promise<void>;
export declare const getHeartbeatMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof heartbeat>>, TError, {
        screenCode: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof heartbeat>>, TError, {
    screenCode: string;
}, TContext>;
export type HeartbeatMutationResult = NonNullable<Awaited<ReturnType<typeof heartbeat>>>;
export type HeartbeatMutationError = ErrorType<void>;
/**
* @summary Update screen last-seen timestamp (called by TV player every minute)
*/
export declare const useHeartbeat: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof heartbeat>>, TError, {
        screenCode: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof heartbeat>>, TError, {
    screenCode: string;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map