import { expectType, expectError } from 'tsd';
import { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import {
	S3ProviderCopyOutput,
	S3ProviderListOutput,
	S3ProviderPutOutput,
	S3ProviderRemoveOutput,
	Storage,
} from '../../lib-esm';

/**
 * This file is for running tsd tests.
 * Supports top-level await.
 */

interface TestCustomConfig {
	provider: 'myProvider';
	foo: number;
	bar: boolean;
}

interface TestCustomReturn {
	foo: number;
}

namespace storage_tests {
	// level must be 'public', 'protected' or 'private'
	expectError(
		Storage.get('key', {
			level: 'notPublic',
		})
	);

	// conditionally return string or GetObjectCommandOutput
	expectType<Promise<string>>(Storage.get('key'));
	expectType<Promise<GetObjectCommandOutput>>(
		Storage.get('key', { download: true })
	);

	// with provider: 'AWSS3', should use the default S3 provider types
	expectType<Promise<string>>(
		Storage.get('key', { provider: 'AWSS3', download: false })
	);

	// test all available configs
	expectType<Promise<string>>(
		Storage.get('key', {
			SSECustomerAlgorithm: 'algo',
			SSECustomerKey: 'key',
			SSECustomerKeyMD5: 'md5',
			cacheControl: 'cacheControl',
			contentDisposition: 'contentDisposition',
			contentEncoding: 'contentEncoding',
			contentLanguage: 'contentLanguage',
			contentType: 'contentType',
			customPrefix: {
				public: 'customPublic',
				protected: 'customProtected',
				private: 'customPrivate',
			},
			download: false,
			expires: 1000,
			progressCallback: _progress => {},
			track: false,
			level: 'protected',
		})
	);

	// allows any config type if provider is specified
	expectType<Promise<string>>(
		Storage.get('key', {
			provider: 'testProvider',
			prop1: false,
			prop2: 'prop',
		})
	);

	// allows custom generic type
	expectType<Promise<string>>(
		Storage.get<TestCustomConfig>('key', {
			provider: 'myProvider',
			foo: 1,
			bar: false,
		})
	);

	// should also allow custom return type
	expectType<Promise<TestCustomReturn>>(
		Storage.get<TestCustomConfig, TestCustomReturn>('key', {
			provider: 'myProvider',
			foo: 1,
			bar: false,
		})
	);

	// should only allow known config properties
	expectError(Storage.get('key', { invalidProp: true }));

	// should adhere to the custom generic config type
	expectError(
		Storage.get<TestCustomConfig>('key', {
			provider: 'myProvider',
			prop1: false,
		})
	);

	const mockBlob = new Blob(['file']);
	const mockFile = new File(['file'], 'file');
	// should allow calling put with blobs or string
	expectType<Promise<S3ProviderPutOutput>>(Storage.put('key', mockBlob));
	expectType<Promise<S3ProviderPutOutput>>(Storage.put('key', mockFile));
	expectType<Promise<S3ProviderPutOutput>>(Storage.put('key', 'string'));

	// with provider: 'AWSS3', should use the default S3 provider types
	expectType<Promise<S3ProviderPutOutput>>(
		Storage.put('key', mockFile, { provider: 'AWSS3' })
	);

	// test all available config
	expectType<Promise<S3ProviderPutOutput>>(
		Storage.put('key', mockFile, {
			progressCallback: _progress => {},
			track: false,
			serverSideEncryption: 'sse',
			SSECustomerAlgorithm: 'algo',
			SSECustomerKey: 'key',
			SSECustomerKeyMD5: 'md5',
			SSEKMSKeyId: 'id',
			acl: 'acl',
			cacheControl: 'cacheControl',
			contentDisposition: 'contentDisposition',
			contentEncoding: 'contentEncoding',
			contentType: 'contentType',
			expires: new Date(),
			metadata: {
				key: 'value',
			},
			tagging: 'tagging',
		})
	);

	// allows any config type if provider is provided
	expectType<Promise<S3ProviderPutOutput>>(
		Storage.put('key', mockFile, {
			provider: 'testProvider',
			prop1: false,
			prop2: 'prop',
		})
	);

	// allows custom generic type
	expectType<Promise<S3ProviderPutOutput>>(
		Storage.put<TestCustomConfig>('key', mockFile, {
			provider: 'myProvider',
			foo: 1,
			bar: false,
		})
	);

	// allows custom return type
	expectType<Promise<TestCustomReturn>>(
		Storage.put<TestCustomConfig, TestCustomReturn>('key', mockFile, {
			provider: 'myProvider',
			foo: 1,
			bar: false,
		})
	);

	// should only allow known config properties
	expectError(Storage.put('key', mockFile, { invalidProp: false }));

	// should adhere to custom generic config type
	expectError(
		Storage.put<TestCustomConfig>('key', mockFile, {
			provider: 'myProvider',
			prop1: false,
		})
	);

	expectType<Promise<S3ProviderListOutput>>(Storage.list('prefix'));
	expectError<Promise<S3ProviderListOutput>>(
		Storage.list('prefix', { invalidProp: false })
	);

	expectType<Promise<S3ProviderRemoveOutput>>(Storage.remove('key'));
	expectError<Promise<S3ProviderListOutput>>(
		Storage.remove('prefix', { invalidProp: false })
	);

	expectType<Promise<S3ProviderCopyOutput>>(
		Storage.copy({ key: 'key1' }, { key: 'key2' })
	);
	expectError<Promise<S3ProviderCopyOutput>>(
		Storage.copy({ key: 'key1' }, { key: 'key2' }, { invalidProp: false })
	);
}
