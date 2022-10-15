import { ReadEmailOnceOptionName, ReadEmailOnceOptionReadState } from '../enums';

export interface ReadEmailOnceInputOptions {
	[ReadEmailOnceOptionName.KindOfEmailsToGet]: ReadEmailOnceOptionReadState,
	[ReadEmailOnceOptionName.MarkAsRead]: boolean,
}
