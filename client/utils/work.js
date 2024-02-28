importScripts("./spark-md5.min.js")
const createChunk = function (file, index, chunkSize) {
    return new Promise((resolve) => {
        const fileReader = new FileReader();
        const start = index * chunkSize;
        const end = index * chunkSize + chunkSize;

        const blob = file.slice(start, end);
        fileReader.onload = function (e) {
            const spark = new SparkMD5();
            spark.append(`${start},${end},${e.target.result}`);
            const hash = spark.end();
            const data = {
                start, end, index, blob, hash
            };
            resolve(data);
        }
        fileReader.readAsArrayBuffer(blob);
    })
}

onmessage = async function (e) {
    const {
        file,
        chunkSize,
        startChunkIndex: start,
        endChunkIndex: end
    } = e.data;

    const proms = [];
    // 遍历单个线程的切片数量
    for (let i = start; i < end; i++) {
        proms.push(createChunk(file, i, chunkSize))
    }
    const chunks = await Promise.all(proms);
    self.postMessage(chunks)

}
