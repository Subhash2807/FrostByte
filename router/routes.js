const router = require('express').Router()
const Student = require('../db/modals/students')
const Coaching = require('../db/modals/coaching')
const Teacher = require('../db/modals/teachers')
const Assignment = require('../db/modals/assignment')
const passport = require('passport')
const bcrypt = require('bcrypt');
const multer = require('multer')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const flash = require('connect-flash')
const {checkAuthenticated,loginCheck} = require('./middlewares/auth')
const {coachingVerify,teacherVerify,studentVerify}=require('../email/email')


router.use(cookieParser('secret'))
router.use(session({
    secret:process.env.SECRET,
    resave:true,
    saveUninitialized:true,
    maxAge:60*60*24*2*1000
}))

router.use(passport.initialize())
router.use(passport.session())

router.use(flash())

//Global variable

router.use((req,res,next)=>{
    res.locals.success_message = req.flash('success_message')
    res.locals.error_message = req.flash('error_message');
    res.locals.error = req.flash('error')
    next();
})

//passport.js
require('../passport')(passport)


router.get('/login',loginCheck,(req,res)=>{
    res.render('login',{err:res.locals.error,error:res.locals.error_message,success:res.locals.success_message})
})

router.get('/register',(req,res)=>{
    res.render('register-home',{err:res.locals.error,error:res.locals.error_message,success:res.locals.success_message});
})






//multer

const upload = new multer({
    limits:{
        fileSize:1000000
    },
    fileFilter(req,file,cb){
        if(!file.originalname.match(/\.(jpg|jpeg|png)/)){
            return cb(new Error('upload image only'))
        }
        cb(undefined,true)
    }
})

//,multer end

// starting of get requrest of registration page
router.get('/register/coaching',(req,res)=>{
    res.render('register-coaching',{err:res.locals.error,error:res.locals.error_message,success:res.locals.success_message})
})

router.get('/register/teacher',(req,res)=>{
    res.render('register-teacher',{err:res.locals.error,error:res.locals.error_message,success:res.locals.success_message})
})

router.get('/register/student',(req,res)=>{
    res.render('register-student',{err:res.locals.error,error:res.locals.error_message,success:res.locals.success_message})
})


// post  request for registration




router.post('/register/coaching',upload.single('avatar'),async (req,res,next)=>{
    if(req.file)
    req.body.avatar = req.file.buffer
    var{email,coaching,name} = req.body

    if(process.env.ADMIN !== req.body.password)
    {
        req.flash('error_message','wrong admin password')
        return res.redirect('/register/coaching')
    }

    if(!email || !name)
    {
        return res.render('register-coaching',{err:'nam and email field must be filled'}) // page in development
    }

    try{

        var user = await Coaching.findOne({email});
        if(user)
        {
            return res.render('register-coaching',{err:'user exit with this username'});
        }
        else{
            user = new Coaching(req.body);
            const result = await user.save();
            req.flash('success_message',"coaching registered successfully....")
            coachingVerify(result.email,result.id)
            return res.redirect('/register');
        }
    }
    catch(e)
    {
        res.render('register-coaching',{err:e})
        throw new Error(e)
    }
})

router.post('/register/teacher',upload.single('avatar'),async (req,res)=>{
    var {name,email,password,password2,coaching} = req.body;
    if(req.file)
    req.body.avatar = req.file.buffer
    if(password2!==password)
    {
       return res.render('register-teacher',{err:'password doesn\'t matched'})
    }
    if(!email || !password || !coaching || !name)
    {
        return res.render('register-teacher',{err:'all field must be filled'})
    }
    if(password.length<8)
    {
        return res.render('register-teacher',{err:'min password length is 8'})
    }
    try{

        var user = await Teacher.findOne({email});
        if(user)
        {
            return res.render('register-teacher',{err:'user exit with this username'});
        }
        else{
            const subject = req.body.subject;
            req.body.password2=undefined;
            var coaching = await Coaching.findOne({name:req.body.coaching})
            
            user = new Teacher(req.body);
            const result = await user.save();
            coaching.teachers.push(user.id);
            coaching[req.body.class].forEach(object =>{
                if(object.subject===subject)
                {
                    object.Teacher=user.id;
                }
            })
            teacherVerify(result.email,result.id)
            await coaching.save()
            
            req.flash('success_message',"registered successfully....login to continue")
            return res.redirect('/login');
            
        }
    }
    catch(e)
    {
        
        res.render('register-teacher',{err:e})
        throw new Error(e)
    }
})



router.post('/register/student',upload.single('avatar'),async (req,res)=>{
    var {name,email,password,password2,coaching} = req.body;
    const clas = req.body.class;
    if(req.file)
    req.body.avatar=req.file.buffer;

    if(password2!==password)
    {
       return res.render('register-student',{err:'password doesn\'t matched'})
    }
    if(!email || !password || !coaching || !name)
    {
        return res.render('register-student',{err:'all field must be filled'})
    }
    if(password.length<8)
    {
        return res.render('register-student',{err:'min password length is 8'})
    }
    try{

        var user = await Student.findOne({email});
        if(user)
        {
            return res.render('register-student',{err:'user exit with this username'});
        }
        else{
            user = new Student(req.body);
            user.data.push({
                coaching:req.body.coaching,
                subjects:[req.body.subject]
            })
            const result = await user.save();
            studentVerify(result.email,result.id)
            const coach = await Coaching.findOne({name:coaching});
            coach.students.push(user.id);
            coach[clas].forEach(object=>{
                if(object.subject===req.body.subject)
                {
                    object.students.push(user.id);
                }
            })
            await coach.save();
            req.flash('success_message',"registered successfully....login to continue")
            return res.redirect('/login');
            
        }
    }
    catch(e)
    {
        res.render('register-student',{err:e})
        throw new Error(e)
    }
})


//login page for student  and teachers

router.post('/login/student',(req,res,next)=>{
    passport.authenticate('user',{
        failureRedirect:'/login',
        successRedirect:'/home/student',
        failureFlash:true
    })(req,res,next);
})
router.post('/login/teacher',(req,res,next)=>{
    passport.authenticate('teacher',{
        failureRedirect:'/login',
        successRedirect:'/home/teacher',
        failureFlash:true
    })(req,res,next);
})



router.get('/room/:room',checkAuthenticated,(req,res)=>{
    res.render('room',{name:req.user.name,email:req.user.email,coaching:req.user.coaching,room:req.params.room});
})


router.get('/logout',(req,res)=>{
    req.logOut();
    res.redirect('/login');
})

module.exports = router;    