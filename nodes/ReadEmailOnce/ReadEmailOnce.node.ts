import { IExecuteFunctions } from 'n8n-core';
import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { FetchQueryObject, ImapFlow, SearchObject } from 'imapflow';
import { ParsedMail, simpleParser } from 'mailparser';
import { ReadEmailOnceCredentials, ReadEmailOnceInputOptions } from './interfaces';
import { ReadEmailOnceOptionName, ReadEmailOnceOptionReadState } from './enums';

export class ReadEmailOnce implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Read Email Once',
		name: 'ssdReadEmailOnce',
		documentationUrl: 'https://github.com/distante/n8n-check-email-node',
		group: ['Email'],
		version: 1,
		description: 'Reads new emails on trigger',
		defaults: {
			name: 'Read Email Once',
		},
		credentials: [
			{
				name: 'readEmailOnceApi',
				required: true,
			},
		],
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Kind Of Emails to Get',
				name: ReadEmailOnceOptionName.KindOfEmailsToGet,
				type: 'options',
				default: `${ReadEmailOnceOptionReadState.Unread}`,
				description: 'Which kind of email to get',
				options: [
					{
						name: ReadEmailOnceOptionReadState.Unread,
						value: ReadEmailOnceOptionReadState.Unread,
					},
				{
					name: ReadEmailOnceOptionReadState.Read,
					value: ReadEmailOnceOptionReadState.Read,
					},
					{
						name: ReadEmailOnceOptionReadState.All,
						value: ReadEmailOnceOptionReadState.All,
					}]
			},
			{
				displayName: 'Mark As Read',
				name: ReadEmailOnceOptionName.MarkAsRead,
				type: 'boolean',
				default: true,
				description: 'Whether to mark the messages as read',
			}
		],
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `myString` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const messagesToMarkAsRead: {uid: number | string, subject: string}[] = []
		const seenFlag = '\\Seen';   	// 'Seen', '\Seen', '\\Seen', '\\\Seen', '\\\\Seen', 'seen'
		const options: ReadEmailOnceInputOptions = getOptions(this);
		const INBOX = 'INBOX';

		const credentials = await this.getCredentials('readEmailOnceApi') as unknown as ReadEmailOnceCredentials;
		const emails: ParsedMail[] = [];

		const client = new ImapFlow({
			host: credentials.host,
			port: credentials.port,
			secure: credentials.secure,
			logger: {
				info: () => void 0,
				debug: () => void 0,
				error: console.error,
				warn: console.warn,
			},
			auth: {
				user: credentials.username,
				pass: credentials.password,
			},
		});

		// Wait until client connects and authorizes
		await client.connect();


		// Select and lock a mailbox. Throws if mailbox does not exist
		const lock = await client.getMailboxLock(INBOX);
		try {
			const fetchOptions: SearchObject = {};

			if (options.kindOfEmailsToGet === ReadEmailOnceOptionReadState.Read) {
				fetchOptions.seen = true
			} else if (options.kindOfEmailsToGet === ReadEmailOnceOptionReadState.Unread) {
				fetchOptions.seen = false
			}

			console.log('\noptions', options);
			console.log('fetch options', fetchOptions);

			for await (let message of client.fetch(fetchOptions, { source: true, uid: true, flags: true })) {
				const parsed = await simpleParser(message.source, {
					skipHtmlToText: true,
				});
				emails.push(parsed);



				console.log('flags', message.flags);
				if (options.markAsRead && !message.flags.has(seenFlag)) {
					messagesToMarkAsRead.push({uid: message.uid, subject: parsed.subject!});
				}
			}

			if (messagesToMarkAsRead.length) {
				console.log('Marking messages as read')
				await client.mailboxOpen(INBOX);

				for await (let message of messagesToMarkAsRead) {
					console.log(`- Marking ${message.subject}`)
					await client.messageFlagsAdd({ uid: message.uid as string  }, [seenFlag]);
				}


			}

			// let mailbox = await client.mailboxOpen('INBOX'); // mark all unseen messages as seen (and keep other flags as is) await client.messageFlagsAdd({seen: false}, ['\Seen]);


		} catch (e) {
			console.error('There was an error with the Read Email OnceNode\n', e)
		} finally {
			// Make sure lock is released, otherwise next `getMailboxLock()` never returns
			lock.release();
		}


		await client.logout();

		console.log(`found ${emails.length} emails`);
		emails.forEach(e => {
			console.log(e.subject);
		})
		const returned: INodeExecutionData[] = emails.map(e => {
			return {json: JSON.parse(JSON.stringify(e))}
		})


		return this.prepareOutputData(returned);
	}
}

function getOptions(executeThis: IExecuteFunctions): ReadEmailOnceInputOptions {
	const options: Partial<ReadEmailOnceInputOptions> = {}

	Object.values(ReadEmailOnceOptionName).forEach(name => {
		options[name] = executeThis.getNodeParameter(name, 0) as any;
	});

	return options as ReadEmailOnceInputOptions
}
