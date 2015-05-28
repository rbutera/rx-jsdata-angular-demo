'use strict';
var controllername = 'home';

module.exports = function(app) {
    var fullname = app.name + '.' + controllername;
    /*jshint validthis: true */

    var deps = [app.name + '.Post', '$log', '$scope'];

    function controller(Post, $log, $scope) {
        var vm = this;
        vm.controllername = fullname;

        vm.allPosts = [];

        var allPostsStream = Post.all.subscribe(
            function(newState){
                // $log.info(fullname + ' got Posts state update #' + timesUpdated + ': ', newState);
                vm.allPosts = newState;
            },
            function(err){
                $log.error(fullname + ' got Posts state ERROR #: ', err);
            },
            function(completed){
                $log.error(fullname + ' Posts COMPLETED', completed);
            }
        );

        $scope.$on('$destroy', function(){
            allPostsStream.dispose();
        });
    }

    controller.$inject = deps;
    app.controller(fullname, controller);
};
