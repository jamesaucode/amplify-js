/*
 * Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
 * the License. A copy of the License is located at
 *
 *     http://aws.amazon.com/apache2.0/
 *
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
 * and limitations under the License.
 */
/**
 * Storage instance options
 */

import { ICredentials } from '@aws-amplify/core';
import {
	StorageProvider,
	StorageProviderApi,
	AWSS3Provider,
	StorageProviderWithCopy,
	S3ProviderGetOuput,
	S3ProviderRemoveOutput,
	S3ProviderListOutput,
	S3ProviderCopyOutput,
	S3ProviderPutOutput,
} from '../';

type Tail<T extends any[]> = ((...t: T) => void) extends (
	h: any,
	...r: infer R
) => void
	? R
	: never;

type Last<T extends any[]> = T[Exclude<keyof T, keyof Tail<T>>];

// Utility type to extract the last parameter type of a function
type LastParameter<F extends (...args: any) => any> = Last<Parameters<F>>;

// Last parameter is always the config object
type ConfigOf<
	T extends StorageProvider,
	U extends StorageProviderApi
> = LastParameter<T[U]>;

export interface StorageOptions {
	credentials?: ICredentials;
	region?: string;
	level?: StorageAccessLevel;
	bucket?: string;
	provider?: string;
	/**
	 * Custom mapping of your prefixes.
	 * For example, customPrefix: { public: 'myPublicPrefix' } will make public level operations access 'myPublicPrefix/'
	 * instead of the default 'public/'.
	 */
	customPrefix?: CustomPrefix;
	/**
	 * if set to true, automatically sends Storage Events to Amazon Pinpoint
	 **/
	track?: boolean;
	dangerouslyConnectToHttpEndpointForTesting?: boolean;
}

export type StorageAccessLevel = 'public' | 'protected' | 'private';

export type CustomPrefix = {
	[key in StorageAccessLevel]?: string;
};

export type StorageCopyTarget = {
	key: string;
	level?: string;
	identityId?: string;
};

export type StorageCopySource = StorageCopyTarget;

export type StorageCopyDestination = Omit<StorageCopyTarget, 'identityId'>;

/**
 * If provider is AWSS3, provider doesn't have to be specified since it's the default, else it has to be passed into
 * config.
 */
type StorageOperationConfigFromProv<
	T extends StorageProvider | StorageProviderWithCopy,
	U extends StorageProviderApi
> = ReturnType<T['getProviderName']> extends 'AWSS3'
	? ConfigOf<AWSS3Provider, U>
	: ConfigOf<T, U> & { provider: ReturnType<T['getProviderName']> };

type StorageOperationOutputFromProv<
	T extends StorageProvider | StorageProviderWithCopy,
	U extends StorageProviderApi
> = ReturnType<T['getProviderName']> extends 'AWSS3'
	? ReturnType<AWSS3Provider[U]>
	: ReturnType<T[U]>;

export type StorageGetConfig<
	T extends StorageProvider | Record<string, any>
> = T extends StorageProvider
	? StorageOperationConfigFromProv<T, 'get'>
	: StorageOperationConfigFromRecord<T, 'get'>;

export type StoragePutConfig<T> = T extends StorageProvider
	? StorageOperationConfigFromProv<T, 'put'>
	: StorageOperationConfigFromRecord<T, 'put'>;

export type StorageRemoveConfig<T> = T extends StorageProvider
	? StorageOperationConfigFromProv<T, 'remove'>
	: StorageOperationConfigFromRecord<T, 'remove'>;

export type StorageListConfig<T> = T extends StorageProvider
	? StorageOperationConfigFromProv<T, 'list'>
	: StorageOperationConfigFromRecord<T, 'list'>;

export type StorageCopyConfig<T> = T extends StorageProviderWithCopy
	? StorageOperationConfigFromProv<T, 'copy'>
	: StorageOperationConfigFromRecord<T, 'copy'>;

/**
 * Check if provider is 'AWSS3', use the default output type else use Promise<any>.
 */
type StorageOperationOutputFromRecord<T, Default> = T extends {
	provider: string;
}
	? T extends { provider: 'AWSS3' }
		? Default
		: Promise<any>
	: Default;

export type StorageGetOutput<
	T extends StorageProvider | Record<string, any>
> = T extends StorageProvider
	? StorageOperationOutputFromProv<T, 'get'>
	: StorageOperationOutputFromRecord<T, Promise<S3ProviderGetOuput<T>>>;

export type StoragePutOutput<
	T extends StorageProvider | Record<string, any>
> = T extends StorageProvider
	? StorageOperationOutputFromProv<T, 'put'>
	: StorageOperationOutputFromRecord<T, S3ProviderPutOutput<T>>;

export type StorageRemoveOutput<
	T extends StorageProvider | Record<string, any>
> = T extends StorageProvider
	? StorageOperationOutputFromProv<T, 'remove'>
	: StorageOperationOutputFromRecord<T, Promise<S3ProviderRemoveOutput>>;

export type StorageListOutput<
	T extends StorageProvider | Record<string, any>
> = T extends StorageProvider
	? StorageOperationOutputFromProv<T, 'list'>
	: StorageOperationOutputFromRecord<T, Promise<S3ProviderListOutput>>;

export type StorageCopyOutput<
	T extends StorageProviderWithCopy | Record<string, any>
> = T extends StorageProvider
	? StorageOperationOutputFromProv<T, 'copy'>
	: StorageOperationOutputFromRecord<T, Promise<S3ProviderCopyOutput>>;

/**
 * Utility type to allow custom provider to use any config keys, if provider is set to AWSS3 then it should use
 * AWSS3Provider's config.
 */
export type StorageOperationConfigFromRecord<
	T extends Record<string, any>,
	api extends StorageProviderApi
> = T extends {
	provider: string;
} // if config has provider, also check if provider is the default AWSS3 provider
	? T extends { provider: 'AWSS3' } // if yes, use the default AWSS3Provider config
		? ConfigOf<AWSS3Provider, api> // else we allow anything as long as it specifies a provider
		: T & { provider: string } // if config does not have provider, fallback to defeault AWSS3 provider config
	: ConfigOf<AWSS3Provider, api>;
