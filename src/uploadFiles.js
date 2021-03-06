const FormData = require("form-data");
const path = require("path");
const fs = require("fs");
const fetch = require("cross-fetch");
const config = require("../config/config.json");

const basePath = config.basePath;
const AUTH = config.API_KEYl
const TIMEOUT = config.TIMEOUT; // Milliseconds. Extend this if needed to wait for each upload. 1000 = 1 second.

const allMetadata = [];

async function main() {
    const files = fs.readdirSync(`${basePath}/build/images`);
    files.sort(function (a, b) {
        return a.split(".")[0] - b.split(".")[0];
    });
    for (const file of files) {
        const fileName = path.parse(file).name;
        let jsonFile = fs.readFileSync(`${basePath}/build/json/${fileName}.json`);
        let metaData = JSON.parse(jsonFile);
        if (!metaData.file_url.includes('https://')) {
            const response = await fetchWithRetry(file);

            metaData.file_url = response.ipfs_url;

            fs.writeFileSync(
                `${basePath}/build/json/${fileName}.json`,
                JSON.stringify(metaData, null, 2)
            );
            console.log(`${response.file_name} uploaded & ${fileName}.json updated!`);
        } else {
            console.log(`${fileName} already uploaded.`);
        }

        allMetadata.push(metaData);
    }
    fs.writeFileSync(
        `${basePath}/build/json/_metadata.json`,
        JSON.stringify(allMetadata, null, 2)
    );
}

main();

function timer(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function fetchWithRetry(file) {
    await timer(TIMEOUT)
    return new Promise((resolve, reject) => {
        const fetch_retry = (_file) => {
            const formData = new FormData();
            const fileStream = fs.createReadStream(`${basePath}/build/images/${_file}`);
            formData.append("file", fileStream);

            let options = {
                method: "POST",
                headers: {
                    Authorization: "57e111bc-99e5-4f9e-b317-31668d4f9639",
                },
                body: formData,
            };

            console.log(options)

            return fetch(config.URL, options).then(async (res) => {
                const status = res.status;

                if (status === 200) {
                    return res.json();
                }
                else {
                    console.error(`ERROR STATUS: ${status}`)
                    console.log('Retrying')
                    await timer(TIMEOUT)
                    fetch_retry(_file)
                }
            })
                .then(async (json) => {

                    console.log(json)

                    if (json.response === "OK") {
                        return resolve(json);
                    } else {
                        console.error(`NOK: ${json.error}`)
                        console.log('Retrying')
                        await timer(TIMEOUT)
                        fetch_retry(_file)
                    }
                })
                .catch(async (error) => {
                    console.log(error);
                    await timer(TIMEOUT)
                    fetch_retry(_file)
                });
        }
        return fetch_retry(file);
    });
}