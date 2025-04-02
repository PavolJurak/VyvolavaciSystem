
const showLoginPage = (req, res) => {
    return res.render('login', {error:""});
}

const login = (req, res) => {
    const { username, password} = req.body;
    if (username === 'admin' && password === 'urgentfntn*875') {
        req.session.user = username;
        res.redirect('/admin/message');
    } else {
        return res.render('login', {error: "Nesprávny login alebo heslo!"})
    }
}

const logout = (req, res) => {
    req.session.destroy(() => {
       res.redirect('/login');
    });
}

module.exports = {
    showLoginPage,
    login,
    logout
}