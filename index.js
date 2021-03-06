/*
 * grunt-cmd-concat
 * https://github.com/spmjs/grunt-cmd-concat
 *
 * Copyright (c) 2013 Hsiaoming Yang
 * Licensed under the MIT license.
 */

var path = require('path');
var md5 = require("MD5");
var fs = require("fs");
module.exports = function (grunt) {
    var count = 0;
    grunt.registerMultiTask('cdnVersion', 'cdnVersion and css img url', function () {
        // Merge task-specific and/or target-specific options with these defaults.
        var options = this.options({

        });

        var oldVerJson, verJson = {};
        try {
            oldVerJson = grunt.file.readJSON(options.verFile);
        } catch (e) {
            //grunt.file.exists(options.verFile)
        }
        var cssList = new Array();
        var md5Files = 0,newVerImgFiles=0;
        this.files.forEach(function (f) {
            // reset records
            //grunt.log.writeln(f.src.toString());
            f.src.filter(function (filepath) {
                // Remove nonexistent files (it's up to you to filter or warn here).
                if(fs.lstatSync(filepath).isDirectory()){
                    return false;
                }
                if (!grunt.file.exists(filepath)) {
                    grunt.log.warn('Source file "' + filepath + '" not found.');
                    return false;
                } else  {
                    return true;
                }
            }).map(function (filepath) {
                    // Read and return the file's source.
                    var extname = path.extname(filepath).replace(".", "");
                    if (extname != "css") {
                        md5Files++;
                        var fileData = grunt.file.read(filepath);
                        var fileVer = {"md5": md5(fileData, {encoding: 'binary'}), "ver": 1};
                        var changedVer = false;
                        if (oldVerJson) {
                            var oldFileVer = oldVerJson[filepath];
                            if (oldFileVer) {
                                if (oldFileVer.md5 != fileVer.md5) {
                                    fileVer.ver = oldFileVer.ver + 1;
                                    changedVer = true;
                                }else{
                                    //无版本变化
                                }
                            }else{//新文件
                                changedVer = true;
                            }
                        } else {//系统第一次运行
                            changedVer = true;
                        }
                        //如果是图片并发生版本变化，把图片送入temp文件夹等待压缩
                        if((changedVer||oldVerJson.imgBigV!=options.imgBigV) && (extname == "jpg" || extname == "gif" || extname == "jpeg" || extname == "png")){
                            grunt.file.copy(filepath,filepath.replace(options.imgSrcDir,options.imgMakeTmpDir));
                            //grunt.file.write(filepath.replace(options.imgSrcDir,options.imgMakeTmpDir),fileData);
                            newVerImgFiles++;
                        }
                        if(changedVer){
                            count++;
                        }
                        verJson[filepath] = fileVer;

                        //grunt.file.write(f.desc, fileData);
                    } else {
                        cssList.push(f);
                    }
                });
        });
        grunt.log.writeln("Have "+md5Files+" files got the MD5 exclude css files");
        grunt.log.writeln("Have "+newVerImgFiles+" new Ver image files copy to temp wait to imageMin");
        //CSS文件批处理文中图片
        var cssImgCount = 0;
        if (cssList.length) {
            cssList.forEach(function (f) {
                var fileData = grunt.file.read(f.src);
                //var m = fileData.match(/url\([\s]*.*[\s]*\)/g);
                var m = fileData.match(/(url\([\s]*.*[\s]*\))|(src=([\'|\"]).*?([\'|\"]))/g);
                if (m && m.length) {
                    m.forEach(function (bgCSS) {
                        var imgUrl = bgCSS.replace("", "").replace(/url\(|\"|\'|\)/g, "").trim();
                        if(imgUrl.toLowerCase() == "about:blank"){return;}
                        var preDirLenMatch = imgUrl.match(/\.\.\//g);
                        var realImgUrl = '', httpimg = false;
                        if (preDirLenMatch && preDirLenMatch.length) {//相对目录
                            //"jumei_web/dist/temp/css/main.css";
                            //"jumei_web/src/images/banner1111_top2.jpg"
                            var a = f.src.toString().split("/");
                            a.splice(a.length - preDirLenMatch.length - 1);

                            realImgUrl = a.join("/") + "/" + imgUrl.replace(/\.\.\//g, "");
                        } else if (imgUrl.charAt(0) == "/") { //"/"
                            //realImgUrl = imgUrl.replace("/" + options.imgUrlReplaceAbsoluteDir, options.imgUrlReplaceDir);
                            realImgUrl = imgUrl.slice(1);
                        } else {//http
                            httpimg = true;
                            realImgUrl = imgUrl;
                        }
                        //grunt.log.writeln(realImgUrl);
                        if (!httpimg) {
                            cssImgCount++;
                            var imgVer = verJson[realImgUrl];
                            realImgUrl = "/" + realImgUrl;
                            if (!imgVer) {
                                //grunt.log.error();
                                grunt.fail.fatal("Image:\<\<" + realImgUrl + "\>\> not found in this project on \<\<" + f.src.toString().replace("dist.temp/","src/") + ">>!");
                            } else {
                                realImgUrl += ("?" + imgVer.ver);
                            }

                            //fileData = fileData.replace(bgCSS, "url(" + realImgUrl.replace(options.imgUrlReplaceDir, options.imgUrlReplaceDirBy) + ")");
                            if(bgCSS.slice(0,3)=="url"){
                                fileData = fileData.replace(bgCSS, "url(" + realImgUrl.replace(options.imgSrcDir, options.imgPublishDir) + ")");
                            }else{
                                fileData = fileData.replace(bgCSS, 'src="' + realImgUrl.replace(options.imgSrcDir, options.imgPublishDir) + '"');
                                //grunt.log.writeln(bgCSS+"----realImgUrl:"+realImgUrl);
                            }
                        }

                    });
                }

                //css文件版本更新
                var fileVer = {"md5": md5(fileData), "ver": 1};
                if (oldVerJson) {
                    var oldFileVer = oldVerJson[f.src];
                    if (oldFileVer) {
                        if (oldFileVer.md5 != fileVer.md5) {
                            fileVer.ver = oldFileVer.ver + 1;
                            count++;
                        } else {
                            fileVer.ver = oldFileVer.ver;
                        }
                    }
                } else {
                    count++;
                }
                verJson[f.src] = fileVer;
                var srcPath = f.src.toString();
                if(srcPath.replace(options.imgSrcDir,"")!=srcPath){//图片目录放CSS文件，警告
                    grunt.log.error("Images dir have css file:"+ srcPath);
                    grunt.file.write(srcPath.replace(options.imgSrcDir, options.imgPublishDir), fileData);
                }else{
                    if (m && m.length) {
                        grunt.file.write(f.dest, fileData);
                    }
                }
            });
            grunt.log.writeln("All css files insert "+cssImgCount+" images");
        }
        grunt.log.writeln('Have ' + count.toString().cyan + ' changed ver files');
        verJson.imgBigV = options.imgBigV;
        verJson.cssBigV = options.cssBigV;
        verJson.jsBigV = options.jsBigV;
        grunt.file.write(options.verFile, JSON.stringify(verJson));
    });
};
