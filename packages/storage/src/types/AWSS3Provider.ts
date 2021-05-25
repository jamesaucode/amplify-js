import {
	GetObjectRequest,
	GetObjectCommandOutput,
	PutObjectRequest,
} from '@aws-sdk/client-s3';
import { StorageOptions } from './Storage';

/** Get API options, specific to Amplify Storage */
export interface StorageGetOptions {
	download?: boolean;
	track?: boolean;
	expires?: number;
}

/** Get API options allowed to be passed to the underlying S3Client */
export interface S3ClientGetOptions {
	bucket?: GetObjectRequest['Bucket'];
	cacheControl?: GetObjectRequest['ResponseCacheControl'];
	contentDisposition?: GetObjectRequest['ResponseContentDisposition'];
	contentEncoding?: GetObjectRequest['ResponseContentEncoding'];
	contentLanguage?: GetObjectRequest['ResponseContentLanguage'];
	contentType?: GetObjectRequest['ResponseContentType'];
}

export type S3ProviderGetOuput<T> = T extends { download: true }
	? GetObjectCommandOutput
	: string;

export type S3ProviderGetOptions = StorageGetOptions &
	S3ClientGetOptions &
	StorageOptions;

/** Put API options, specific to Amplify Storage */
export interface StoragePutOptions {
	progressCallback?: (progress: any) => any;
}

/** Put API options allowed to be passed to the underlying S3Client */
export interface S3ClientPutOptions {
	bucket?: PutObjectRequest['Bucket'];
	cacheControl?: PutObjectRequest['CacheControl'];
	contentDisposition?: PutObjectRequest['ContentDisposition'];
	contentEncoding?: PutObjectRequest['ContentEncoding'];
	contentType?: PutObjectRequest['ContentType'];
	metadata?: PutObjectRequest['Metadata'];
	tagging?: PutObjectRequest['Tagging'];
	acl?: PutObjectRequest['ACL'];
	expires?: PutObjectRequest['Expires'];
}

export interface S3ClientServerSideEncryptionOptions {
	serverSideEncryption: PutObjectRequest['ServerSideEncryption'];
	SSECustomerAlgorithm?: PutObjectRequest['SSECustomerAlgorithm'];
	SSECustomerKey?: PutObjectRequest['SSECustomerKey'];
	SSECustomerKeyMD5?: PutObjectRequest['SSECustomerKeyMD5'];
	SSEKMSKeyId?: PutObjectRequest['SSEKMSKeyId'];
}

export type S3ProviderPutOptions =
	| (StoragePutOptions & S3ClientPutOptions)
	| (StoragePutOptions &
			S3ClientPutOptions &
			S3ClientServerSideEncryptionOptions);
