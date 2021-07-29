import { AWSS3UploadTask } from './AWSS3UploadTask';
import * as events from 'events';
import {
	S3Client,
	ListPartsCommand,
	ListPartsCommandOutput,
	CreateMultipartUploadCommand,
	AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { StorageHelper } from '@aws-amplify/core';
import { StorageLevel } from '../types/Storage';

const idb = window.indexedDB;
const oneHourInMs = 1000 * 60 * 60;
const IDB_KEY = 'AmplifyStorageIDB';

type UploadId = string;

interface AddTaskInput {
	accessLevel: StorageLevel;
	file: Blob;
	bucket: string;
	emitter?: events.EventEmitter;
	key: string;
	s3Client: S3Client;
}

interface FileMetadata {
	accessLevel: StorageLevel;
	bucket: string;
	fileName: string;
	key: string;
	// Unix timestamp in ms
	lastTouched: number;
	timeStarted: number;
	uploadId: UploadId;
}

export enum TaskEvents {
	ABORT = 'abort',
	UPLOAD_COMPLETE = 'uploadComplete',
	UPLOAD_PROGRESS = 'uploadPartProgress',
}

const UPLOADS_STORAGE_KEY = '__uploadInProgress';

export class AWSS3UploadManager {
	private readonly _storage: Storage;
	private readonly _uploadTasks: Record<UploadId, AWSS3UploadTask> = {};
	private readonly _config: any;
	private readonly _s3Client: S3Client;

	constructor() {
		this._storage = new StorageHelper().getStorage();
	}

	private _listUploadTasks() {
		const tasks = this._storage.getItem(UPLOADS_STORAGE_KEY);
		return JSON.parse(tasks);
	}

	private async _getCachedUploadParts({
		s3client,
		bucket,
		key,
		file,
	}: {
		s3client: S3Client;
		bucket: string;
		key: string;
		file: Blob;
	}): Promise<ListPartsCommandOutput> {
		const uploadsFromStorage = this._storage.getItem(UPLOADS_STORAGE_KEY);
		if (!uploadsFromStorage) {
			return null;
		}
		const uploads = JSON.parse(uploadsFromStorage) || {};
		const fileKey = this._getFileKey(file, bucket, key);
		if (!uploads.hasOwnProperty(fileKey)) {
			return null;
		}
		const cachedUploadFileData: FileMetadata = uploads[this._getFileKey(file, bucket, key)] || {};
		const hasExpired =
			cachedUploadFileData.hasOwnProperty('lastTouched') && Date.now() - cachedUploadFileData.lastTouched > oneHourInMs;
		if (cachedUploadFileData && !hasExpired) {
			cachedUploadFileData.lastTouched = Date.now();
			this._storage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
			const listPartsOutput = await s3client.send(
				new ListPartsCommand({
					Bucket: bucket,
					Key: key,
					UploadId: cachedUploadFileData.uploadId,
				})
			);
			return listPartsOutput;
		}
	}

	/**
	 * Generate a unique key for the file.
	 *
	 * @param blob - Blob that should be uploaded.
	 * @return unique key of the file.
	 */
	private _getFileKey(blob: Blob, bucket: string, key: string): string {
		// We should check if it's a File first because File is also instance of a Blob
		if (this._isFile(blob)) {
			return [blob.name, blob.lastModified, blob.size, blob.type, bucket, key].join('-');
		} else if (this._isBlob(blob)) {
			return [blob.size, blob.type, bucket, key].join('-');
		} else return '';
	}

	private _listFilesFromIDB = async () => {
		return new Promise((res, rej) => {
			const request = idb.open(IDB_KEY, 2);
			request.onsuccess = (_e: any) => {
				const db = request.result;
				db.onerror = (e: any) => {
					console.error('Error reating or accessing indexedDB database');
					rej(e);
				};
				const t = db.transaction(['files'], 'readonly');
				const objStore = t.objectStore('files');
				const req = objStore.getAll();
				req.onsuccess = (e: any) => {
					console.log(e.target.result);
					res(e.target.result);
				};
			};
		});
	};

	private _findFileFromIDB = async (fileName: string): Promise<Blob> => {
		return new Promise((res, rej) => {
			const request = idb.open(IDB_KEY, 2);
			request.onsuccess = (_e: any) => {
				const db = request.result;
				db.onerror = (e: any) => {
					console.error('Error reating or accessing indexedDB database');
					rej(e);
				};

				db
					.transaction(['files'], 'readonly')
					.objectStore('files')
					.index('file_name')
					.get(fileName).onsuccess = (e: any) => {
					res(e.target.result);
				};
			};
		});
	};

	private _storeFileToIDB = async (input: AddTaskInput) => {
		return new Promise((res, rej) => {
			function putFile(db: IDBDatabase, file: Blob) {
				db
					.transaction(['files'], 'readwrite')
					.objectStore('files')
					.put(file).onsuccess = (e: any) => {
					res(e);
				};
			}

			const request = idb.open(IDB_KEY, 2);
			request.onsuccess = event => {
				const db = request.result;
				db.onerror = _event => {
					console.error('Error reating or accessing indexedDB database');
				};
				putFile(db, input.file);
			};
			request.onerror = event => {
				console.log(event);
				rej(event);
			};
			request.onupgradeneeded = event => {
				const db = request.result;
				const objectStore = db.createObjectStore('files', { keyPath: 'name' });
				objectStore.createIndex('file_name', 'name');
				objectStore.transaction.oncomplete = event => {
					putFile(db, input.file);
				};
			};
		});
	};

	private _getFileFromIDB = async (fileName: string): Promise<Blob> => {
		const request = idb.open(IDB_KEY);
		let file: File;
		return new Promise((res, rej) => {
			request.onsuccess = event => {
				const db = request.result;
				console.log(event);
				db.onerror = _event => {
					console.error('Error reating or accessing indexedDB database');
				};
				const t = db.transaction(['files'], 'readonly');
				const filesObjStore = t.objectStore('files').index('file_name');
				const req = filesObjStore.get(fileName);
				req.onsuccess = (event: any) => {
					file = event.target.result;
					res(file);
				};
				req.onerror = event => {
					rej(event);
				};
			};
		});
	};
	/**
	 * Purge all keys from storage that were expired.
	 *
	 * @param [ttl] - [Specify how long since the task has started should it be considered expired]
	 */
	private _purgeExpiredKeys(input: { s3Client: S3Client; ttl?: number; emitter?: events.EventEmitter }) {
		const { s3Client, ttl = oneHourInMs } = input;
		const uploads: Record<string, FileMetadata> = JSON.parse(this._storage.getItem(UPLOADS_STORAGE_KEY)) || {};
		for (const [k, upload] of Object.entries(uploads)) {
			const hasExpired =
				Object.prototype.hasOwnProperty.call(upload, 'timeStarted') && Date.now() - (upload as any).timeStarted > ttl;
			console.log(`${k} : ${JSON.stringify(upload)}`);
			if (hasExpired) {
				s3Client
					.send(
						new AbortMultipartUploadCommand({
							Bucket: upload.bucket,
							Key: upload.key,
							UploadId: upload.uploadId,
						})
					)
					.then(res => {
						console.log(res);
						console.log(`Purging ${k}`);
						delete uploads[k];
					});
			}
		}
		this._storage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
	}

	private _removeKey(key: string) {
		console.log(`Removing ${key}`);
		const uploads = JSON.parse(this._storage.getItem(UPLOADS_STORAGE_KEY)) || {};
		delete uploads[key];
		this._storage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
	}

	private _isListPartsOutput(x: unknown): x is ListPartsCommandOutput {
		return (
			x &&
			typeof x === 'object' &&
			Object.prototype.hasOwnProperty.call(x, 'UploadId') &&
			Object.prototype.hasOwnProperty.call(x, 'Parts')
		);
	}

	public async listTasks(s3Client: S3Client) {
		const uploadsFromStorage = this._storage.getItem(UPLOADS_STORAGE_KEY);
		if (!uploadsFromStorage) {
			return null;
		}
		const uploads: Record<string, FileMetadata> = JSON.parse(uploadsFromStorage) || {};
		return new Promise((res, rej) => {
			const request = idb.open(IDB_KEY, 2);
			request.onsuccess = (_e: any) => {
				const db = request.result;
				db.onerror = (e: any) => {
					console.error('Error reating or accessing indexedDB database');
					rej(e);
				};
				const t = db.transaction(['files'], 'readonly');
				const objStore = t.objectStore('files');
				const req = objStore.getAll();
				req.onsuccess = (e: any) => {
					console.log(e.target.result);
					const files: File[] = e.target.result;
					const fs = files.map(f => ({
						blob: f,
						...Object.values(uploads).find(u => u.fileName === f.name),
					}));
					res(
						fs.map(
							f =>
								new AWSS3UploadTask({
									bucket: f.bucket,
									key: f.key,
									uploadId: f.uploadId,
									file: f.blob,
									s3Client,
									emitter: new events.EventEmitter(),
								})
						)
					);
				};
			};
		});
	}

	public async createTask(input: AddTaskInput) {
		const task = this.addTask(input);
		return task;
	}

	public async addTask(input: AddTaskInput): Promise<AWSS3UploadTask> {
		const { s3Client, bucket, key, file, emitter } = input;
		let cachedUpload = {};
		this._purgeExpiredKeys({
			s3Client,
		});
		try {
			console.log('Finding cached upload parts');
			cachedUpload =
				(await this._getCachedUploadParts({
					s3client: s3Client,
					bucket,
					key,
					file: file,
				})) || {};
		} catch (err) {
			console.error('Error finding cached upload parts, will re-initialize the multipart upload');
		}
		const fileKey = this._getFileKey(file, bucket, key);
		emitter.on(TaskEvents.UPLOAD_COMPLETE, () => {
			this._removeKey(fileKey);
		});
		emitter.on(TaskEvents.ABORT, () => {
			this._removeKey(fileKey);
		});
		if (this._isListPartsOutput(cachedUpload)) {
			const cachedUploadId = cachedUpload.UploadId;
			const uploadedPartsOnS3 = cachedUpload.Parts;
			console.log('Found cached upload parts', uploadedPartsOnS3);
			this._uploadTasks[cachedUploadId] = new AWSS3UploadTask({
				s3Client,
				uploadId: cachedUpload.UploadId,
				bucket,
				key,
				file: file,
				completedParts: cachedUpload.Parts,
				emitter,
			});
			return this._uploadTasks[cachedUploadId];
		}
		return this._initMultiupload(input);
	}

	private async _initMultiupload(input: AddTaskInput) {
		console.log('cached upload not found, creating a new one');
		const { s3Client, bucket, key, file, emitter, accessLevel } = input;
		let f = await this._findFileFromIDB((file as File).name);
		if (f) {
			console.log('Found this file in IDB!');
		} else {
			await this._storeFileToIDB(input);
			f = input.file;
		}
		const fileKey = this._getFileKey(file as File, bucket, key);
		const createMultipartUpload = await s3Client.send(
			new CreateMultipartUploadCommand({
				Bucket: bucket,
				Key: key,
			})
		);
		const newTask = new AWSS3UploadTask({
			s3Client,
			uploadId: createMultipartUpload.UploadId,
			bucket,
			key,
			file: f,
			emitter,
		});
		this._uploadTasks[createMultipartUpload.UploadId] = newTask;
		const fileMetadata: FileMetadata = {
			uploadId: createMultipartUpload.UploadId,
			timeStarted: Date.now(),
			lastTouched: Date.now(),
			bucket,
			key,
			accessLevel,
			...(this._isFile(f) && { fileName: f.name }),
		};
		this._addKey(fileKey, fileMetadata);
		return newTask;
	}

	private _addKey(key: string, fileMetadata: FileMetadata) {
		const uploads = JSON.parse(this._storage.getItem(UPLOADS_STORAGE_KEY)) || {};
		uploads[key] = fileMetadata;
		this._storage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
	}

	public getTask(uploadId: UploadId): AWSS3UploadTask {
		return this._uploadTasks[uploadId];
	}

	private _isBlob(x: unknown): x is Blob {
		return x instanceof Blob;
	}

	private _isFile(x: unknown): x is File {
		return x instanceof File;
	}
}
