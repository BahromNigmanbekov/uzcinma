import {ensureSeriesSchema,visibleSQL} from '../server/series.js';
import {database} from '../server/core.js';
import {telegramMediaConfigured,readTelegramRange} from '../server/telegram-media.js';
import {createTelegramStreamHandler} from '../server/telegram-stream.js';
export default createTelegramStreamHandler({
 configured:telegramMediaConfigured,readRange:readTelegramRange,
 findMovie:async id=>{const db=database();await ensureSeriesSchema(db);return (await db.execute({sql:'SELECT m.id,m.file_unique_id,m.file_id,m.file_size,m.mime_type,m.source_message_id,m.deleted FROM movies m WHERE m.id=? AND '+visibleSQL('m'),args:[id]})).rows[0];}
});
