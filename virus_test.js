var child = require("child_process"),
	async = require("async");

var run = 10,
	runCloudTest = true,
	runProxyTest = false,
	runUtilityTest = false,
	uploadBandwidth = 10 * 1024 / 8, // * KB
	downloadBandwidth = 10 * 1024 / 8;

var url = "http://linux7.cs.nctu.edu.tw:9999/service/virus/scan?",
	proxy = "http://linux8.cs.nctu.edu.tw:8000";
	opt = "-w ':Total time: %{time_total}'";

var files = [
	{
		"path": "/net/alpha/chiehyou/test100K.jpg",
		"proxyTime": 0.032, // execution time on proxy
		"cloudTime": 0.011,// execution time on cloud
	},
	{
		"path": "/usr/lib/libstdc++.so.6.0.18",
		"proxyTime": 0.041,
		"cloudTime": 0.022,
	},
	{
		"path": "/net/alpha/chiehyou/com.android.vending-4.1.6.apk",
		"proxyTime": 0.103,
		"cloudTime": 0.070,
	},
	{
		"path": "/usr/bin/clang",
		"proxyTime": 0.220,
		"cloudTime": 0.148,
	},
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

function createUtility(file, utility) {
	var str = "User-Policy: ";
	if(utility) {
		if(utility.responseTime) {
			str += "responseTime='" + utility.responseTime + "',";
		}

		if(utility.transferData) {
			str += "dataTransferSize='" + utility.transferData + "',";
		}
	}

	if(file) {
		str += "pt2='" + file.proxyTime + "',";
		str += "ct2='" + file.cloudTime + "',";
	}

	return str;
}

console.log("=========================================================================================");
console.log("number of files: " + files.length + ", number of utilities: " + utilities.length + ", runs: " + run);
console.log("url: " + url);
console.log("bandwidth limit: " + downloadBandwidth + "/" + uploadBandwidth + " Kbps");
console.log("=========================================================================================");

var funcs = [];
var index = 0;

files.forEach(function(file) {

	funcs.push(function(callback) {                                              
		console.log("## File: " + file.path + " ---------------------------");
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
			var cmd = "curl -X POST -F'file=@" + file.path + "' '" + url + "&i=" + index + "' " + opt 
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
            var cmd = "curl -X POST -F'file=@" + file.path + "' '" + url + "&i=" + index + "' " + opt
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
				var cmd = "trickle -s -d " + downloadBandwidth + " -u " + uploadBandwidth + " curl -X POST -F'file=@" + file.path + "' '" + url 
						+ "&i=" + index + "' " + opt + " -H '" + createUtility(null, null) + "no-served' -x '" + proxy + "'";
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
				var cmd = "curl -X POST -F'file=@" + file.path + "' '" + url + "&i=" + index + "' " + opt 
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
						var cmd = "curl -X POST -F'file=@" + file.path + "' '" + url + "&i=" + index + "' " + opt + " -H '" + createUtility(file, utility) + "' -x '" + proxy + "'";
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

/* End of file virus_test.js */

