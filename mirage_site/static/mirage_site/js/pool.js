var show_content = function(results) {

    var get_pool_info = function() {
        //extract pool information from document url
        var parser = document.createElement('a');
        parser.href = document.URL;
        path_arr = parser.pathname.split('/');
        return {'vehicle': path_arr[2], 'pool_number': path_arr[3]}
    }

    var render_column = function(v, prefix, setaside_code) {
        //returns properly formatted column for vendor/socioeconomic indicator

        var vendor_indicator = function(v, prefix, setaside_code) {
            //returns X if vendor and socioeconomic indicator match
            if (v['setasides'].length > 0) {
                for (var i=0; i<v['setasides'].length; i++) {
                    if (v['setasides'][i]['code'] == setaside_code) {
                        return 'X';
                    }
                }
            } else {
                return '';
            }
        }

        col = $(document.createElement('td'));
        col.attr('class', prefix);
        col.text(vendor_indicator(v, prefix, setaside_code));
        return col
    }

    var addRow = function(v) {

        var clean_location = function(location) {
            // from http://stackoverflow.com/questions/5097875/help-parsing-string-city-state-zip-with-javascript

            var to_title_case = function(str) {
                return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
            }

            var location_obj = {};
            new_location = location;
            if (location) {
                location = location.trim();
                var comma = location.indexOf(',');
                location_obj.city = location.slice(0, comma);
                var after = location.substring(comma + 2);
                var space = after.lastIndexOf(' ');
                location_obj.state = after.slice(0, space).toUpperCase();
                new_location = to_title_case(location_obj.city) + ', ' + location_obj.state
            }
            return new_location
        }

        //append search result to search results table
        t = $(document.getElementById('pool_vendors'));
        vendor_row = $(document.createElement('tr'));

        name_col = $(document.createElement('td'));
        name_col.attr('class', 'vendor_name');
        name_col.text(v.name);
        vendor_row.append(name_col);

        location_col = $(document.createElement('td'));
        location_col.attr('class', 'vendor_location');
        location_col.text(clean_location(v.sam_citystate));
        vendor_row.append(location_col);

        //add socio-economic columns
        vendor_row.append(render_column(v, 'vo', 'A5'));
        vendor_row.append(render_column(v, 'sdb', '27'));
        vendor_row.append(render_column(v, 'sdvo', 'QF'));
        vendor_row.append(render_column(v, 'wo', 'A2'));

        //add row to table
        t.append(vendor_row);
    }

    var container = $("#custom_page_content");
    var data = results['results'];
    var pool_info = get_pool_info();

    //load SAM update date
    var date_obj = new Date(results['sam_load']);
    $("#sam_load").text("SAM data updated: " + (date_obj.getMonth() + 1) + '/' + date_obj.getDate() + '/' + date_obj.getFullYear().toString().substring(2));

    //clear out old results (remove all rows but first)
    $("#pool_vendors").find("tr:gt(0)").remove();

    //load results and add them to table
    var total = 0;
    for (var e in data) {
        var obj = data[e];
        if (obj['vehicle'].toUpperCase() == pool_info['vehicle'].toUpperCase() && obj['number'].toUpperCase() == pool_info['pool_number'].toUpperCase()) {
            for (var v in obj['vendors']) {
                addRow(obj['vendors'][v]);
            }
            total = obj['vendors'].length;
            break;
        }
    }
    
    //load title data
    $("#number_of_results span").text(total.toString() + " vendors match your search");
}

$(document).ready(function() {
    //load results when page loads
    refresh_data();
})
