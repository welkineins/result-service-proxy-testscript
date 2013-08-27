var child = require("child_process"),
	async = require("async");

var run = 10,
	runCloudTest = false,
	runProxyTest = false,
	runUtilityTest = true,
	uploadBandwidth = 10 * 1024 / 8, // * KB
	downloadBandwidth = 10 * 1024 / 8,
	delayRequest = [];

var url = "http://linux7.cs.nctu.edu.tw:9999/service/mashup/do?url=http://linux8.cs.nctu.edu.tw:7777/mashup/face",
	proxy = "http://linux8.cs.nctu.edu.tw:8000";
	opt = "-w ':Total time: %{time_total}'";

var images = [
	/*{
		"path": "/net/alpha/chiehyou/test100K.jpg",
		"proxyTime1": 0.08, // execution time of preprocess on proxy
		"proxyTime2": 1.192, // execution time of face detection on proxy
		"cloudTime1": 0.036,// execution time of preprocess on cloud
		"cloudTime2": 0.595, // execution time of face detection on cloud
	},
	{
		"path": "/net/alpha/chiehyou/test500K.jpg",
		"proxyTime1": 0.122,
		"proxyTime2": 2.69,
		"cloudTime1": 0.085,
		"cloudTime2": 1.069,
	},
	{
		"path": "/net/alpha/chiehyou/test1M.jpg",
		"proxyTime1": 0.22,
		"proxyTime2": 4.88,
		"cloudTime1": 0.135,
		"cloudTime2": 1.66,
	},*/
	{
		"path": "/net/alpha/chiehyou/test5M.jpg",
		"proxyTime1": 0.61,
		"proxyTime2": 20.31,
		"cloudTime1": 0.46,
		"cloudTime2": 5.9,
	},
/*	{
		"path": "/net/alpha/chiehyou/test10M.jpg",
		"proxyTime1": 2,
		"proxyTime2": 52,
		"cloudTime1": 1.4,
		"cloudTime2": 25.6,
	}*/
];

var utilities = [
	// concave
	{ responseTime: "http://linux7.cs.nctu.edu.tw:9999/utility_function/exponential/concave2", transferData: "" },
	{ responseTime: "", transferData: "http://linux7.cs.nctu.edu.tw:9999/utility_function/exponential/concave1" },
	{ responseTime: "http://linux7.cs.nctu.edu.tw:9999/utility_function/exponential/concave2", transferData: "http://linux7.cs.nctu.edu.tw:9999/utility_function/exponential/concave1" },
	// convex
	{ responseTime: "http://linux7.cs.nctu.edu.tw:9999/utility_function/exponential/convex2", transferData: "" },
	{ responseTime: "", transferData: "http://linux7.cs.nctu.edu.tw:9999/utility_function/exponential/convex1" },
	{ responseTime: "http://linux7.cs.nctu.edu.tw:9999/utility_function/exponential/convex2", transferData: "http://linux7.cs.nctu.edu.tw:9999/utility_function/exponential/convex1" },
	// linear
	{ responseTime: "http://linux7.cs.nctu.edu.tw:9999/utility_function/linear/t_down20", transferData: "" },
	{ responseTime: "", transferData: "http://linux7.cs.nctu.edu.tw:9999/utility_function/linear/d_down20" },
	{ responseTime: "http://linux7.cs.nctu.edu.tw:9999/utility_function/linear/t_down20", transferData: "http://linux7.cs.nctu.edu.tw:9999/utility_function/linear/d_down20" },
];

function createUtility(image, utility) {
	var str = "User-Policy: ";
	if(utility) {
		if(utility.responseTime) {
			str += "responseTime='" + utility.responseTime + "',";
		}

		if(utility.transferData) {
			str += "dataTransferSize='" + utility.transferData + "',";
		}
	}

	if(image) {
		str += "pt1='" + image.proxyTime1 + "',";
		str += "pt2='" + image.proxyTime2 + "',";
		str += "ct1='" + image.cloudTime1 + "',";
		str += "ct2='" + image.cloudTime2 + "',";
	}

	return str;
}

console.log("=========================================================================================");
console.log("number of images: " + images.length + ", number of utilities: " + utilities.length + ", runs: " + run);
console.log("url: " + url);
console.log("bandwidth limit: " + downloadBandwidth + "/" + uploadBandwidth + " KBps");
console.log("=========================================================================================");

var funcs = [];
var index = 0;

images.forEach(function(image) {

	funcs.push(function(callback) {                                              
		console.log("## Images: " + image.path + " ---------------------------");
		callback(null, null);                                                    
	});

	//-- Warm Up
	//-------------------------------------------------
	// Make Proxy & Cloud server ready
	//-------------------------------------------------
	funcs.push(function(callback) {
		console.log("# Warn up ---------------------");
		callback(null, null);
	});

	for(var i = 0; i < 3; ++i) {
		funcs.push(function(callback) {
			var cmd = "curl -X POST -F'file=@" + image.path + "' '" + url + "&i=" + index + "' " + opt 
						+ " -H '" + createUtility(null, null) + "no-forward' -x '" + proxy + "'";
			child.exec(cmd, function(error, stdout, stderr) {
				var start = stdout.lastIndexOf("]") + 2;
				console.log("#@ " + index);
				console.log(stdout.slice(start, stdout.length));
				++index;
				callback(null, null);
			});
		});
	}

	for(var i = 0; i < 3; ++i) {
        funcs.push(function(callback) {
            var cmd = "curl -X POST -F'file=@" + image.path + "' '" + url + "&i=" + index + "' " + opt
                        + " -H '" + createUtility(null, null) + "no-served' -x '" + proxy + "'";
            child.exec(cmd, function(error, stdout, stderr) {
                var start = stdout.lastIndexOf("]") + 2;
                console.log("#@ " + index);
                console.log(stdout.slice(start, stdout.length));
                ++index;
                callback(null, null);
            });
        });
    }

	//-- Cloud only
	//-------------------------------------------------
	// Go to upstream directly without passing Proxy
	//-------------------------------------------------
	if(runCloudTest) {
		funcs.push(function(callback) { 
			console.log("# Testing face detection on Cloud only");
			callback(null, null);
		});

		for(var i = 0; i < run; ++i) {
			funcs.push(function(callback) {
				var cmd = "trickle -s -d " + downloadBandwidth + " -u " + uploadBandwidth + " curl -X POST -F'file=@" + image.path + "' '" + url 
						+ "&i=" + index + "' " + opt + " -H '" + createUtility(null, null) + "no-served' -x '" + proxy + "'";
			console.log(cmd);
				child.exec(cmd, function(error, stdout, stderr) {
					var start = stdout.lastIndexOf("]") + 2;
					console.log("#@ " + index);
					console.log(stdout.slice(start, stdout.length));
					++index;
					callback(null, null);
				});
			});
		}
	}
		
	//-- Proxy only
	//-------------------------------------------------
	// Run on Proxy only, not forward to Cloud
	// This is done by adding 'no-forward' flag
	//-------------------------------------------------
	if(runProxyTest) {
		funcs.push(function(callback) {
			console.log("# Testing face detection on Proxy only");
			callback(null, null);
		});

		for(var i = 0; i < run; ++i) {
			funcs.push(function(callback) {
				var cmd = "curl -X POST -F'file=@" + image.path + "' '" + url + "&i=" + index + "' " + opt 
							+ " -H '" + createUtility(null, null) + "no-forward' -x '" + proxy + "'";
				child.exec(cmd, function(error, stdout, stderr) {
					var start = stdout.lastIndexOf("]") + 2;        
					console.log("#@ " + index);
					console.log(stdout.slice(start, stdout.length));
					++index;
					callback(null, null);
				});
			});
		}
	}

	//-- Utility Method
	//-------------------------------------------------
	if(runUtilityTest) {
		funcs.push(function(callback) {
			console.log("# Testing face detection using Utility Method");
			callback(null, null);
		});

		utilities.forEach(function(utility) {
			funcs.push(function(callback) {
				console.log("## Utility:" + JSON.stringify(utility));
				callback(null, null);
			});

			for(var i = 0; i < run; ++i) {
				funcs.push((function(utility) {
					function f(callback) {
						var cmd = "curl -X POST -F'file=@" + image.path + "' '" + url + "&i=" + index + "' " + opt + " -H '" + createUtility(image, utility) + "' -x '" + proxy + "'";
						child.exec(cmd, function(error, stdout, stderr) {
							var start = stdout.lastIndexOf("]") + 2;        
							console.log("#@ " + index);
							console.log(stdout.slice(start, stdout.length));
							++index;
							callback(null, null);
						});
					};
					return f;
				}(utility))); //closure
			}
		});
	}
});


// Execution
async.series(funcs, function(err, result){});

/* End of file index.js */

