import { ICredentialDataDecryptedObject } from 'n8n-workflow';

export interface ReadEmailOnceCredentials{
		host: string;
		port: number;
		secure:  boolean;
		username: string;
		password: string;
}
