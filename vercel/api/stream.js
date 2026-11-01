import {database} from '../server/core.js';
import {telegramMediaConfigured,readTelegramRange} from '../server/telegram-media.js';
import {createTelegramStreamHandler} from '../server/telegram-stream.js';
export default createTelegramStreamHandler({
 configured:telegramMediaConfigured,readRange:readTelegramRange,
 findMovie:async id=>(await database().execute({sql:'SELECT id,file_unique_id,file_id,file_size,mime_type,source_message_id,deleted FROM movies WHERE id=? AND deleted=0',args:[id]})).rows[0]
});
