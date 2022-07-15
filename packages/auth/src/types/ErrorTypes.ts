export const SignInErrorCodes = {
	NOT_AUTHORIZED: 'NotAuthorizedException',
	PASSWORD_RESET_REQUIRED: 'PasswordResetRequiredException',
	INVALID_USERNAME: '',
} as const;

type SignInErrorCode = typeof SignInErrorCodes[keyof typeof SignInErrorCodes];

export class AuthSignInError extends Error {
	readonly code: SignInErrorCode;
	constructor(message: string, code?: SignInErrorCode) {
		super(message);

		this.constructor = AuthSignInError;
		Object.setPrototypeOf(this, AuthSignInError.prototype);

		this.name = this.constructor.name;
		this.code = code;
	}
}
