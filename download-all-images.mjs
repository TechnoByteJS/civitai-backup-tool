import { argv, exit } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const username = argv[2];

if (!username) {
	console.error('Usage: node download-all-images.mjs <username>');
	exit(1);
}

const outputDir = path.join('.', username);
fs.mkdirSync(outputDir, { recursive: true });

async function fetchImageData(user, cursor) {
	const url = `https://civitai.com/api/v1/images?username=${user}&sort=Newest&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`API Error: ${response.status}`);
		return await response.json();
	} catch (error) {
		console.error(`Failed to fetch ${url}: ${error.message}`);
		return null;
	}
}

async function downloadImage(url, filePath, timestamp) {
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Download Error: ${response.status}`);
		const buffer = Buffer.from(await response.arrayBuffer());
		fs.writeFileSync(filePath, buffer);
		fs.utimesSync(filePath, timestamp, timestamp);
	} catch (error) {
		console.error(`Failed to download/save ${url}: ${error.message}`);
	}
}

async function run() {
	let cursor = undefined;
	do {
		const data = await fetchImageData(username, cursor);
		if (!data || !data.items || data.items.length === 0) break;

		for (const item of data.items) {
			const createdAt = new Date(item.createdAt);
			const baseName = path.basename(new URL(item.url).pathname);
			const imgFilePath = path.join(outputDir, baseName);
			const jsonFilePath = path.join(outputDir, `${path.parse(baseName).name}.json`);

			await downloadImage(item.url, imgFilePath, createdAt);
			fs.writeFileSync(jsonFilePath, JSON.stringify(item, null, 2));
			fs.utimesSync(jsonFilePath, createdAt, createdAt);
		}
		cursor = data.metadata?.nextCursor;
	} while (cursor);
	console.log('Download process finished.');
}

run().catch(err => {
	console.error("Script failed:", err);
	exit(1);
});