import { GetObjectRequest, GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { StorageOptions } from './Storage';

/** Options for the get API, specific to Amplify Storage */
export interface StorageGetOptions {
	download?: boolean;
	track?: boolean;
	expires?: number;
}

/** Options allowed to be passed to the underlying S3Client */
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
