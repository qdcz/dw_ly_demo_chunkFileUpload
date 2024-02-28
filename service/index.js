const express = require('express');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');

const app = express();
const PORT = process.env.PORT || 3000;

// cross
app.all("*", function (req, res, next,) {
    res.header("Access-Control-Allow-Origin", "*",);
    res.header(
        "Access-Control-Allow-Headers",
        "content-type,authorization",
    );
    res.header(
        "Access-Control-Allow-Methods",
        "DELETE,PUT,POST,GET,OPTIONS",
    );
    if (req.method.toLowerCase() == "options") res.sendStatus(200,);
    else next();
});
app.use(express.json(),);
app.use(express.urlencoded({ extended: true, },),);


// 设置静态文件目录
// app.use(express.static(path.join(__dirname, 'public')));


/**
 * 
 * 全局配置文件
 * 
 */
const chunkSize = 1024 * 1024 * 50 // 50M
// 用于缓存当前文件上传的验证文件
const dataCache = [];


/**
 * 验证文件是否存在，提示前端是否覆盖上传
 */
app.post("/checkFileExist", (req, res) => {
    const { filename } = req.body;
    try {
        const flag = fs.existsSync(path.join(__dirname, "uploads", filename));
        flag ?
            res.status(500).json({ success: true, message: '文件存在！', data: flag })
            :
            res.status(200).json({ success: true, message: '文件不存在！', data: e });
    } catch (e) {
        res.status(200).json({ success: true, message: '文件不存在！', data: e });
    }
})

/**
 * 用于验证上传文件的完整性
 *  */
app.post("/verificationFileFull", (req, res) => {
    const { index, filename, fileSize, hash } = req.body;
    const chunkCount = Math.ceil(fileSize / chunkSize);
    // 一个文件不用验证和合并文件
    if (chunkCount == 1) {
        res.status(200).json({ success: true, message: '文件验证成功！', data: null });
        return
    }
    try {
        fs.existsSync(path.join(__dirname, "uploads", filename + `.part${index}`));
        // TODO  这边还需验证文件大小是否完整匹配上。
        // 判断是否验证过了
        const findIndex = dataCache.findIndex(ele => ele.hash == hash);
        if (findIndex == -1) {
            dataCache.push({ ...req.body })
        } else {
            res.status(500).json({ success: true, message: '文件已经过验证', });
            return
        }

        // 每次分片验证的时候需要判断是否已经可以合并文件
        const verifyCount = dataCache.filter(ele => ele.filename == filename);
        if (verifyCount.length == chunkCount) {
            console.log("开始合并文件！");
            // 按顺序追加文件
            for (let i = 0; i < chunkCount; i++) {
                const oldPath = path.join(__dirname, "uploads", `${filename}`);
                const chunkPath = path.join(__dirname, "uploads", filename + `.part${i}`);
                fs.appendFileSync(oldPath, fs.readFileSync(chunkPath));
                // 删除分片文件
                fs.unlink(chunkPath, (err, data) => {
                    if (err) {
                        res.status(500).json({ success: true, message: '分片文件删除失败！', });
                        return
                    }
                    console.log(`${chunkPath},分片文件删除成功！`)
                })
            }

            // 删除dataCache中filename == filename的数据
            let removedIndexes = [];
            for (let i = 0; i < dataCache.length; i++) {
                if (dataCache[i].filename === filename) {
                    dataCache.splice(i, 1); // 从数组中删除匹配的项
                    removedIndexes.push(i);
                }
            }
        }
    } catch (e) {
        res.status(500).json({ success: true, message: '验证文件异常！', data: e });
        return
    }
    res.status(200).json({
        success: true, message: 'chunk file verify successfully', data: null
    });
})

/**
 * 用于上传文件的接口
 */
app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm();
    // 设置上传文件存储路径
    form.uploadDir = path.join(__dirname, 'uploads');
    // 解析上传的分片文件
    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Error parsing form: ', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        // chunk字段是取不到的
        const { index, fileSize, filename, chunk, hash } = fields;
        const chunkCount = Math.ceil(fileSize / chunkSize);

        const oldPath = path.resolve(files.chunk[0].filepath);
        // 如果是小于切片的大小直接存储即可
        if (chunkCount == 1) {
            fs.renameSync(oldPath, path.join(__dirname, "uploads", filename[0]));
        } else {
            fs.renameSync(oldPath, path.join(__dirname, "uploads", filename[0]) + `.part${index[0]}`);
        }
        res.status(200).json({ index: index[0], fileSize, filename, hash, });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
